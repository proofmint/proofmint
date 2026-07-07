/**
 * One-time restore script for the AlgoHack 1.0 (Synergia) Participant 2026
 * bulk issuance whose DB rows were lost.
 *
 * What it does:
 *   1. Scans local Storacha backup metadata (.bin files) to find every
 *      certificate metadata JSON that belongs to this batch
 *      (filtered by name/unit_name/Event Name).
 *   2. Reads the CSV and matches each recipient to a metadata file by
 *      "Recipient Name" (normalised).
 *   3. Queries the Algorand indexer for the issuer's asset-config txns
 *      to recover the assetId + mint txn id + mint round time for each
 *      metadata CID (the asset's URL is `ipfs://<metadataCid>#arc3`).
 *   4. Queries the indexer for asset-transfer txns out of the issuer
 *      wallet to determine who claimed each certificate (if anyone).
 *   5. Creates a BulkIssuanceJob row + IssuedCertificate rows in the DB
 *      with mintingStatus = MINTED and status = CLAIMED/PENDING as
 *      appropriate.
 *   6. For unclaimed recipients we leave the cert PENDING (no user is
 *      created — sync-claim-status.ts can pick it up later).
 *   7. For claimed recipients whose vault key still works (or whose user
 *      record still exists in the DB), we stub-create the receiver user
 *      if missing and record the claim.
 *   8. For claimed recipients whose vault key was lost (chain shows an
 *      address we cannot derive from the recipient's email), the script
 *      will (with --execute) clawback the asset from the lost wallet
 *      back to a newly-created vault wallet for that email and record
 *      the clawback txn as the claim txn.
 *   9. For those same lost wallets, the script also scans for *any other*
 *      ASAs the wallet still holds (from this issuer or any other issuer
 *      on the platform). Any such asset whose clawback address matches a
 *      known Issuer's wallet is swept to the same newly-created wallet
 *      (with --execute), so the recipient doesn't lose other certificates
 *      /badges stranded in the same lost wallet. Assets whose clawback
 *      address doesn't match a platform issuer are left alone (we have no
 *      authority to move them) and are only reported.
 *  10. Each swept asset already has its own IssuedCertificate/IssuedBadge
 *      row from whatever job originally issued it, still pointing at the
 *      lost wallet's claim txn — the script updates that row's
 *      claimTransactionHash/transactionHash (and status) to the recovery
 *      txn so the DB matches on-chain custody. All sweeps (recovered or
 *      not) are recorded in the created job's statusMessages for audit.
 *
 * Usage:
 *   tsx --tsconfig tsconfig.scripts.json scripts/restore-algohack-bulk.ts
 *       (dry-run — analyses only, writes nothing to DB or chain)
 *   tsx --tsconfig tsconfig.scripts.json scripts/restore-algohack-bulk.ts --execute
 *       (writes DB rows + performs clawback for lost-vault claims)
 *   tsx --tsconfig tsconfig.scripts.json scripts/restore-algohack-bulk.ts --execute --no-clawback
 *       (writes DB rows; lost-vault claims are left PENDING for manual review)
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import algosdk, { Indexer } from "algosdk";

import prisma from "@/lib/prisma";
import { getWallet, signTransactions } from "@/lib/vault";
import { cleanString, getHash } from "@/lib/utils";
import {
  VAULT_HOST,
  VAULT_TOKEN,
  algodClient,
  ADMIN_WALLET,
} from "@/lib/const";
import { parseCSV } from "@/lib/utils/csvParser";
import { JobStatus } from "@prisma/client";

// ─── Constants ─────────────────────────────────────────────────────────────

const TEMPLATE_ID = "cmpjlkqa70001zw04k2gqp237";
const CSV_PATH = path.join(
  process.cwd(),
  "AlgoHack_1.0_(Synergia)_Participant_2026_template.csv",
);
const BACKUP_IMAGES_DIR = path.join(
  process.cwd(),
  "uploads",
  "metadata",
);

const CERTIFICATE_NAME = "AlgoHack 1.0 Participant";
const UNIT_NAME = "ALGOHACK";
const DESCRIPTION =
  "This Certificate is Awarded for Participating at AlgoHack 1.0 2026.";
const CUSTOM_PROPERTIES: Array<{ key: string; value: string }> = [
  { key: "Dates", value: "31st March, 2026 - 1st April 2026" },
  { key: "Venue", value: "BVRIT Hyderabad College of Engineering for Women" },
  { key: "Duration", value: "24 Hours" },
];
const EVENT_NAME = "AlgoHack 1.0";

const DRY_RUN = !process.argv.includes("--execute");
const ENABLE_CLAWBACK = !process.argv.includes("--no-clawback");

const INDEXER_URL =
  process.env.ALGORAND_NETWORK === "testnet"
    ? "https://testnet-idx.4160.nodely.dev"
    : "https://mainnet-idx.4160.nodely.dev";
const indexer = new Indexer("a".repeat(64), INDEXER_URL, 443);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Helpers ───────────────────────────────────────────────────────────────

function normName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function parseIpfsImage(image: string): string | null {
  // metadata.image is `ipfs://<cid>#arc3` or `ipfs://<cid>`
  const m = image.match(/^ipfs:\/\/([^/#?]+)/);
  return m ? m[1] : null;
}

async function getExistingVaultWallet(email: string): Promise<string | null> {
  try {
    const key = getHash(cleanString(email));
    const res = await fetch(`${VAULT_HOST}/v1/transit/keys/${key}`, {
      method: "GET",
      headers: { "X-Vault-Token": VAULT_TOKEN },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const publicKey = Buffer.from(data.data.keys["1"].public_key, "base64");
    return algosdk.encodeAddress(publicKey);
  } catch {
    return null;
  }
}

async function findOrCreateStubUser(
  email: string,
  walletAddress: string,
): Promise<void> {
  const normalised = cleanString(email);
  const existing = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true },
  });
  if (existing) return;

  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString("hex"),
    10,
  );

  await prisma.user.create({
    data: {
      email: normalised,
      fullName: "",
      organizationName: "",
      passwordHash,
      role: "RECEIVER",
      walletAddress,
      emailVerified: false,
    },
  });
  console.log(`      + stub user created for ${normalised} (${walletAddress})`);
}

async function createVaultWalletAndUser(email: string): Promise<string | null> {
  const normalised = cleanString(email);
  const existing = await prisma.user.findUnique({
    where: { email: normalised },
    select: { walletAddress: true },
  });
  if (existing) return existing.walletAddress;

  const wallet = await getWallet(getHash(normalised));
  if (!wallet) return null;

  await findOrCreateStubUser(normalised, wallet);
  return wallet;
}

// Swept assets belong to some other (already-existing) IssuedCertificate or
// IssuedBadge row minted by a different job/issuer. Their stored claim txn
// still points at the lost wallet, so re-point it at the recovery txn.
async function updateExistingClaimForSweep(params: {
  email: string;
  assetId: string;
  newTxnId: string;
}): Promise<"certificate" | "badge" | "none"> {
  const normalisedEmail = cleanString(params.email);

  const cert = await prisma.issuedCertificate.findFirst({
    where: { assetId: params.assetId, receiverEmail: normalisedEmail },
    select: { id: true },
  });
  if (cert) {
    await prisma.issuedCertificate.update({
      where: { id: cert.id },
      data: { status: "CLAIMED", claimTransactionHash: params.newTxnId },
    });
    return "certificate";
  }

  const badgeInstance = await prisma.issuedBadge.findFirst({
    where: {
      receiverEmail: normalisedEmail,
      badge: { assetId: params.assetId },
    },
    select: { id: true },
  });
  if (badgeInstance) {
    await prisma.issuedBadge.update({
      where: { id: badgeInstance.id },
      data: { status: "CLAIMED", transactionHash: params.newTxnId },
    });
    return "badge";
  }

  return "none";
}

// ─── Metadata discovery ────────────────────────────────────────────────────

interface CertMetadata {
  metadataCid: string;
  imageCid: string;
  recipientName: string;
  collegeName: string;
  eventName: string;
  raw: any;
}

async function loadAllMetadata(): Promise<CertMetadata[]> {
  const files = await fs.readdir(BACKUP_IMAGES_DIR);
  const metadataFiles = files.filter((f) => f.endsWith(".json"));
  console.log(`Scanning ${metadataFiles.length} .json metadata file(s)…`);

  const matches: CertMetadata[] = [];
  for (const file of metadataFiles) {
    const cid = file.replace(/\.json$/, "");
    let json: any;
    try {
      const buf = await fs.readFile(path.join(BACKUP_IMAGES_DIR, file), "utf8");
      json = JSON.parse(buf);
    } catch {
      continue;
    }

    if (
      json?.name !== CERTIFICATE_NAME ||
      json?.unit_name !== UNIT_NAME ||
      json?.properties?.["Event Name"] !== EVENT_NAME
    ) {
      continue;
    }

    const imageCid = parseIpfsImage(json.image ?? "");
    if (!imageCid) continue;

    matches.push({
      metadataCid: cid,
      imageCid,
      recipientName: String(json.properties["Recipient Name"] ?? ""),
      collegeName: String(json.properties["College Name"] ?? ""),
      eventName: String(json.properties["Event Name"] ?? ""),
      raw: json,
    });
  }

  console.log(`  → ${matches.length} match this batch\n`);
  return matches;
}

// ─── Indexer: asset creation + transfer recovery ───────────────────────────

interface AssetMintInfo {
  assetId: string;
  mintTxnId: string;
  mintedAt: Date;
  url: string;
}

async function listIssuerCreatedAssets(
  issuerWallet: string,
): Promise<AssetMintInfo[]> {
  console.log(`Listing assets created by ${issuerWallet}…`);
  const out: AssetMintInfo[] = [];
  let nextToken: string | undefined;

  while (true) {
    let query: any = indexer
      .searchForTransactions()
      .address(issuerWallet)
      .addressRole("sender")
      .txType("acfg");
    if (nextToken) query = query.nextToken(nextToken);

    const res = await query.do();
    for (const txn of res.transactions ?? []) {
      const createdId = txn.createdAssetIndex;
      if (!createdId) continue;
      const params = txn.assetConfigTransaction?.params;
      if (!params?.url) continue;
      if (params.unitName !== UNIT_NAME) continue;
      if (params.name !== CERTIFICATE_NAME) continue;

      out.push({
        assetId: String(createdId),
        mintTxnId: String(txn.id),
        mintedAt: new Date(Number(txn.roundTime ?? 0) * 1000),
        url: String(params.url),
      });
    }

    if (res.nextToken) {
      nextToken = res.nextToken;
      await sleep(120);
    } else {
      break;
    }
  }

  console.log(`  → ${out.length} ${CERTIFICATE_NAME} asset(s) created\n`);
  return out;
}

async function findAxferTransfers(
  assetId: string,
  issuerWallet: string,
): Promise<Array<{ receiver: string; txnId: string; claimedAt: Date }>> {
  const out: Array<{ receiver: string; txnId: string; claimedAt: Date }> = [];
  let nextToken: string | undefined;

  while (true) {
    let query = indexer
      .lookupAssetTransactions(Number(assetId))
      .address(issuerWallet)
      .addressRole("sender")
      .currencyGreaterThan(0)
      .currencyLessThan(2)
      .txType("axfer")
      .excludeCloseTo(true);
    if (nextToken) query = query.nextToken(nextToken);

    const res = await query.do();
    for (const txn of res.transactions ?? []) {
      const recv = txn.assetTransferTransaction?.receiver;
      if (!recv || !txn.id || !txn.roundTime) continue;
      out.push({
        receiver: String(recv),
        txnId: String(txn.id),
        claimedAt: new Date(Number(txn.roundTime) * 1000),
      });
    }

    if (res.nextToken) {
      nextToken = res.nextToken;
      await sleep(120);
    } else {
      break;
    }
  }
  return out;
}

// ─── Other-asset discovery (lost-wallet sweep) ─────────────────────────────

interface HeldAsset {
  assetId: string;
  amount: bigint;
}

interface AssetAuthority {
  clawbackAddress: string | null;
  name: string;
  unitName: string;
}

interface SweepCandidate {
  assetId: string;
  name: string;
  unitName: string;
  issuerWallet: string;
  issuerEmail: string;
}

interface UnrecoverableAsset {
  assetId: string;
  name: string;
  unitName: string;
  clawbackAddress: string | null;
}

async function getAccountHeldAssets(address: string): Promise<HeldAsset[]> {
  try {
    const info = await algodClient.accountInformation(address).do();
    const assets = (info.assets ?? []) as Array<{
      assetId: bigint;
      amount: bigint;
    }>;
    return assets
      .filter((a) => a.amount > 0n)
      .map((a) => ({ assetId: String(a.assetId), amount: a.amount }));
  } catch {
    return [];
  }
}

async function getAssetAuthority(
  assetId: string,
): Promise<AssetAuthority | null> {
  try {
    const info = await algodClient.getAssetByID(Number(assetId)).do();
    const params = info.params;
    return {
      clawbackAddress: params.clawback ? String(params.clawback) : null,
      name: String(params.name ?? ""),
      unitName: String(params.unitName ?? ""),
    };
  } catch {
    return null;
  }
}

async function findIssuerWalletUser(
  walletAddress: string,
): Promise<{ email: string; wallet: string } | null> {
  const user = await prisma.user.findFirst({
    where: { walletAddress, issuerProfile: { isNot: null } },
    select: { email: true, walletAddress: true },
  });
  return user ? { email: user.email, wallet: user.walletAddress } : null;
}

// Any other asset a lost wallet still holds, from this issuer or any other
// issuer on the platform, whose clawback authority we control.
async function findSweepableAssets(params: {
  lostWallet: string;
  excludeAssetId: string;
}): Promise<{
  sweepable: SweepCandidate[];
  unrecoverable: UnrecoverableAsset[];
}> {
  const held = await getAccountHeldAssets(params.lostWallet);
  const sweepable: SweepCandidate[] = [];
  const unrecoverable: UnrecoverableAsset[] = [];

  for (const h of held) {
    if (h.assetId === params.excludeAssetId) continue;
    const authority = await getAssetAuthority(h.assetId);
    await sleep(80);

    if (!authority?.clawbackAddress) {
      unrecoverable.push({
        assetId: h.assetId,
        name: authority?.name ?? "",
        unitName: authority?.unitName ?? "",
        clawbackAddress: authority?.clawbackAddress ?? null,
      });
      continue;
    }

    const issuerUser = await findIssuerWalletUser(authority.clawbackAddress);
    if (!issuerUser) {
      unrecoverable.push({
        assetId: h.assetId,
        name: authority.name,
        unitName: authority.unitName,
        clawbackAddress: authority.clawbackAddress,
      });
      continue;
    }

    sweepable.push({
      assetId: h.assetId,
      name: authority.name,
      unitName: authority.unitName,
      issuerWallet: issuerUser.wallet,
      issuerEmail: issuerUser.email,
    });
  }

  return { sweepable, unrecoverable };
}

// ─── Clawback ──────────────────────────────────────────────────────────────

async function performClawbackForCert(params: {
  assetId: string;
  fromWallet: string;
  toEmail: string;
  toWallet: string;
  issuerWallet: string;
  issuerEmail: string;
  isSweep: boolean;
}): Promise<string> {
  const {
    assetId,
    fromWallet,
    toEmail,
    toWallet,
    issuerWallet,
    issuerEmail,
    isSweep,
  } = params;

  // Step 1: fund + opt-in the new wallet
  let spFund = await algodClient.getTransactionParams().do();
  let spFree = await algodClient.getTransactionParams().do();
  spFund.flatFee = true;
  spFund.fee = BigInt(2000);
  spFree.flatFee = true;
  spFree.fee = BigInt(0);

  const optInGroup = [
    {
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: ADMIN_WALLET,
        receiver: toWallet,
        amount: algosdk.algosToMicroalgos(isSweep ? 0.1 : 0.2),
        suggestedParams: spFund,
      }),
      signerEmail: "admin",
      signerAddress: ADMIN_WALLET,
    },
    {
      txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: toWallet,
        receiver: toWallet,
        amount: 0,
        assetIndex: Number(assetId),
        suggestedParams: spFree,
      }),
      signerEmail: toEmail,
      signerAddress: toWallet,
    },
  ];

  const optInRes = await signTransactions(optInGroup);
  await algodClient.sendRawTransaction(optInRes.bytes).do();
  await algosdk.waitForConfirmation(algodClient, optInRes.txnIds[0], 4);
  console.log(
    `      ✓ ${isSweep ? "sweep " : ""}opt-in done (${optInRes.txnIds[1]})`,
  );

  // Step 2: clawback issued asset from old (lost) wallet to new wallet
  spFund = await algodClient.getTransactionParams().do();
  spFree = await algodClient.getTransactionParams().do();
  spFund.flatFee = true;
  spFund.fee = BigInt(2000);
  spFree.flatFee = true;
  spFree.fee = BigInt(0);
  const clawbackGroup = [
    {
      txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: issuerWallet,
        receiver: toWallet,
        assetSender: fromWallet,
        amount: 1,
        assetIndex: Number(assetId),
        suggestedParams: spFree,
      }),
      signerEmail: issuerEmail,
      signerAddress: issuerWallet,
    },
    {
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: ADMIN_WALLET,
        receiver: ADMIN_WALLET,
        amount: 0,
        suggestedParams: spFund,
      }),
      signerEmail: "admin",
      signerAddress: ADMIN_WALLET,
    },
  ];
  const clawbackRes = await signTransactions(clawbackGroup);
  await algodClient.sendRawTransaction(clawbackRes.bytes).do();
  await algosdk.waitForConfirmation(algodClient, clawbackRes.txnIds[0], 4);
  console.log(
    `      ✓ ${isSweep ? "sweep " : ""}clawback done (${clawbackRes.txnIds[0]})`,
  );

  return clawbackRes.txnIds[0];
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `Restore AlgoHack bulk — network=${process.env.ALGORAND_NETWORK ?? "mainnet"} ` +
      `${DRY_RUN ? "[DRY-RUN]" : "[EXECUTE]"} ` +
      `${ENABLE_CLAWBACK ? "[clawback ON]" : "[clawback OFF]"}\n`,
  );

  // 1. Resolve template + issuer
  const template = await prisma.certificateTemplate.findUnique({
    where: { id: TEMPLATE_ID },
    include: { issuer: { include: { user: true } } },
  });
  if (!template) {
    throw new Error(`Template ${TEMPLATE_ID} not found`);
  }
  const issuerId = template.issuerId;
  const issuerWallet = template.issuer.user.walletAddress;
  const issuerEmail = template.issuer.user.email;
  console.log(
    `Template: ${template.templateName}\nIssuer: ${issuerId} (${issuerEmail}, ${issuerWallet})\n`,
  );

  // 2. Sanity: no existing job for this template
  const existingJobs = await prisma.bulkIssuanceJob.count({
    where: { certificateTemplateId: TEMPLATE_ID },
  });
  if (existingJobs > 0) {
    throw new Error(
      `Refusing to run: ${existingJobs} BulkIssuanceJob row(s) already exist for template ${TEMPLATE_ID}. Delete them first if this restore should run again.`,
    );
  }

  // 3. Load CSV
  const csvText = await fs.readFile(CSV_PATH, "utf8");
  const csvRows = await parseCSV(csvText);
  console.log(`CSV: ${csvRows.length} recipient(s)\n`);

  // 4. Discover metadata + assets
  const metadataList = await loadAllMetadata();
  const metadataByName = new Map<string, CertMetadata>();
  for (const m of metadataList) {
    const key = normName(m.recipientName);
    if (metadataByName.has(key)) {
      console.log(
        `  ! duplicate metadata name "${m.recipientName}" — keeping first`,
      );
      continue;
    }
    metadataByName.set(key, m);
  }

  const assets = await listIssuerCreatedAssets(issuerWallet);
  const assetByMetaCid = new Map<string, AssetMintInfo>();
  for (const a of assets) {
    const m = a.url.match(/^ipfs:\/\/([^/#?]+)/);
    if (!m) continue;
    if (!assetByMetaCid.has(m[1])) assetByMetaCid.set(m[1], a);
  }

  // 5. Build per-row plan
  type Plan = {
    rowIndex: number;
    email: string;
    csvName: string;
    metadata?: CertMetadata;
    asset?: AssetMintInfo;
    properties: Record<string, string>;
    claim?: { receiver: string; txnId: string; claimedAt: Date };
    claimResolution:
      | "no-claim"
      | "claim-matches-db"
      | "claim-matches-vault"
      | "claim-lost-vault";
    finalReceiverWallet?: string;
    needsClawback: boolean;
    sweepAssets: SweepCandidate[];
    unrecoverableAssets: UnrecoverableAsset[];
  };

  const plans: Plan[] = [];
  const mergedCustom: Record<string, string> = {};
  for (const p of CUSTOM_PROPERTIES) mergedCustom[p.key] = p.value;

  for (let i = 0; i < csvRows.length; i++) {
    const row = csvRows[i];
    const csvName = row.fieldData["Recipient Name"] ?? "";
    const meta = metadataByName.get(normName(csvName));
    const asset = meta ? assetByMetaCid.get(meta.metadataCid) : undefined;

    const properties: Record<string, string> = {
      ...row.fieldData,
      ...mergedCustom,
    };

    const plan: Plan = {
      rowIndex: i,
      email: cleanString(row.email),
      csvName,
      metadata: meta,
      asset,
      properties,
      claimResolution: "no-claim",
      needsClawback: false,
      sweepAssets: [],
      unrecoverableAssets: [],
    };

    if (asset) {
      const transfers = await findAxferTransfers(asset.assetId, issuerWallet);
      // Prefer the most recent transfer (in case of weirdness)
      const last = transfers[0];
      if (last) {
        plan.claim = last;
        // Who does the chain receiver match?
        const dbUser = await prisma.user.findFirst({
          where: { walletAddress: last.receiver },
          select: { email: true },
        });
        const vaultWallet = await getExistingVaultWallet(plan.email);

        if (dbUser && cleanString(dbUser.email) === plan.email) {
          plan.claimResolution = "claim-matches-db";
          plan.finalReceiverWallet = last.receiver;
        } else if (vaultWallet && vaultWallet === last.receiver) {
          plan.claimResolution = "claim-matches-vault";
          plan.finalReceiverWallet = last.receiver;
        } else {
          // The on-chain wallet doesn't match the email — vault key for
          // that wallet is lost (or the email never had a working key).
          plan.claimResolution = "claim-lost-vault";
          plan.needsClawback = ENABLE_CLAWBACK;

          const { sweepable, unrecoverable } = await findSweepableAssets({
            lostWallet: last.receiver,
            excludeAssetId: asset.assetId,
          });
          plan.sweepAssets = sweepable;
          plan.unrecoverableAssets = unrecoverable;
          if (sweepable.length) {
            console.log(
              `      + ${sweepable.length} other recoverable asset(s) in lost wallet: ` +
                sweepable.map((s) => s.assetId).join(", "),
            );
          }
          if (unrecoverable.length) {
            console.log(
              `      ! ${unrecoverable.length} other asset(s) in lost wallet cannot be recovered (unknown issuer): ` +
                unrecoverable.map((s) => s.assetId).join(", "),
            );
          }
        }
      }
      await sleep(120);
    }

    plans.push(plan);
    const tag = !asset
      ? "NO-ASSET"
      : !plan.claim
        ? "no-claim"
        : plan.claimResolution;
    console.log(
      `  [${i + 1}/${csvRows.length}] ${plan.email.padEnd(40)} ` +
        `${(asset?.assetId ?? "-").padStart(12)}  ${tag}`,
    );
  }

  const UNKOWN_METADATA_ASSETS = assets.filter(
    (a) =>
      !plans
        .map((p) => {
          if (p.asset) return p.asset.assetId;
        })
        .filter((assetId) => assetId !== undefined)
        .includes(a.assetId),
  );
  console.log(`\n UNKNOWN METADATA ASSETS:\n`);
  for (const a of UNKOWN_METADATA_ASSETS) {
    console.log(`  ${a.assetId}  ${a.url}`);
  }

  // 6. Summary
  const summary = {
    total: plans.length,
    withAsset: plans.filter((p) => !!p.asset).length,
    noAsset: plans.filter((p) => !p.asset).length,
    noClaim: plans.filter((p) => p.asset && !p.claim).length,
    claimDb: plans.filter((p) => p.claimResolution === "claim-matches-db")
      .length,
    claimVault: plans.filter((p) => p.claimResolution === "claim-matches-vault")
      .length,
    claimLostVault: plans.filter(
      (p) => p.claimResolution === "claim-lost-vault",
    ).length,
    extraAssetsSweepable: plans.reduce((n, p) => n + p.sweepAssets.length, 0),
    extraAssetsUnrecoverable: plans.reduce(
      (n, p) => n + p.unrecoverableAssets.length,
      0,
    ),
  };
  console.log("\nSummary:", summary);

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] no DB writes. Re-run with --execute to apply.");
    await prisma.$disconnect();
    return;
  }

  // 7. Create job + cert rows (one transaction for the job + rows)
  const totalItems = plans.length;
  const job = await prisma.bulkIssuanceJob.create({
    data: {
      issuerId,
      certificateTemplateId: TEMPLATE_ID,
      certificateName: CERTIFICATE_NAME,
      unitName: UNIT_NAME,
      description: DESCRIPTION,
      sendEmail: true,
      customProperties: CUSTOM_PROPERTIES as unknown as object,
      recipientData: csvRows as unknown as object,
      status: JobStatus.PROCESSING,
      totalItems,
      processedItems: 0,
      failedItems: 0,
      statusMessages: { restoredBy: "scripts/restore-algohack-bulk.ts" },
    },
  });
  console.log(`\nCreated BulkIssuanceJob ${job.id}`);

  let processed = 0;
  let failed = 0;
  const extraSweeps: Array<{
    email: string;
    assetId: string;
    name: string;
    unitName: string;
    fromWallet: string;
    toWallet: string;
    txnId: string;
    updatedRecord: "certificate" | "badge" | "none";
  }> = [];

  for (const plan of plans) {
    try {
      const baseData = {
        templateId: TEMPLATE_ID,
        receiverEmail: plan.email,
        issuerId,
        jobId: job.id,
        certificateName: CERTIFICATE_NAME,
        unitName: UNIT_NAME,
        description: DESCRIPTION,
        properties: plan.properties as unknown as object,
      };

      if (!plan.asset || !plan.metadata) {
        // No on-chain asset for this row — mark FAILED so it's visible.
        await prisma.issuedCertificate.create({
          data: {
            ...baseData,
            mintingStatus: "FAILED",
            status: "PENDING",
            errorMessage:
              "Restore: no matching metadata or on-chain asset was found for this recipient.",
          },
        });
        failed++;
        continue;
      }

      // Default values for a MINTED cert with no claim yet
      let status: "PENDING" | "CLAIMED" = "PENDING";
      let claimedAt: Date | null = null;
      let claimTxn: string | null = null;

      if (plan.claim) {
        switch (plan.claimResolution) {
          case "claim-matches-db":
          case "claim-matches-vault": {
            status = "CLAIMED";
            claimedAt = plan.claim.claimedAt;
            claimTxn = plan.claim.txnId;
            if (plan.finalReceiverWallet) {
              await findOrCreateStubUser(plan.email, plan.finalReceiverWallet);
            }
            break;
          }
          case "claim-lost-vault": {
            if (plan.needsClawback) {
              const newWallet = await createVaultWalletAndUser(plan.email);
              if (!newWallet) {
                throw new Error(
                  "vault key creation failed for lost-vault claim",
                );
              }
              const clawbackTxn = await performClawbackForCert({
                assetId: plan.asset.assetId,
                fromWallet: plan.claim.receiver,
                toEmail: plan.email,
                toWallet: newWallet,
                issuerWallet,
                issuerEmail,
                isSweep: false,
              });
              status = "CLAIMED";
              claimedAt = new Date();
              claimTxn = clawbackTxn;

              for (const extra of plan.sweepAssets) {
                try {
                  const extraTxn = await performClawbackForCert({
                    assetId: extra.assetId,
                    fromWallet: plan.claim.receiver,
                    toEmail: plan.email,
                    toWallet: newWallet,
                    issuerWallet: extra.issuerWallet,
                    issuerEmail: extra.issuerEmail,
                    isSweep: true,
                  });
                  const updatedRecord = await updateExistingClaimForSweep({
                    email: plan.email,
                    assetId: extra.assetId,
                    newTxnId: extraTxn,
                  });
                  extraSweeps.push({
                    email: plan.email,
                    assetId: extra.assetId,
                    name: extra.name,
                    unitName: extra.unitName,
                    fromWallet: plan.claim.receiver,
                    toWallet: newWallet,
                    txnId: extraTxn,
                    updatedRecord,
                  });
                  console.log(
                    `      ✓ swept extra asset ${extra.assetId} (${extra.unitName}) to ${newWallet}` +
                      (updatedRecord !== "none"
                        ? ` — updated ${updatedRecord} claim record`
                        : ` — no matching certificate/badge row found to update`),
                  );
                } catch (err) {
                  console.error(
                    `      ✗ failed to sweep extra asset ${extra.assetId} for ${plan.email}:`,
                    (err as Error).message,
                  );
                }
              }
            } else {
              // Clawback disabled — record the cert as PENDING with a note
              await prisma.issuedCertificate.create({
                data: {
                  ...baseData,
                  assetId: plan.asset.assetId,
                  imageCid: plan.metadata.imageCid,
                  metadataCid: plan.metadata.metadataCid,
                  mintingStatus: "MINTED",
                  status: "PENDING",
                  mintTransactionHash: plan.asset.mintTxnId,
                  issuedAt: plan.asset.mintedAt,
                  errorMessage: `Restore: on-chain claim by ${plan.claim.receiver} (txn ${plan.claim.txnId}) but vault key for ${plan.email} is lost. Clawback disabled.`,
                },
              });
              processed++;
              continue;
            }
            break;
          }
        }
      }

      await prisma.issuedCertificate.create({
        data: {
          ...baseData,
          assetId: plan.asset.assetId,
          imageCid: plan.metadata.imageCid,
          metadataCid: plan.metadata.metadataCid,
          mintingStatus: "MINTED",
          status,
          mintTransactionHash: plan.asset.mintTxnId,
          claimTransactionHash: claimTxn,
          issuedAt: plan.asset.mintedAt,
          claimedAt,
        },
      });
      processed++;
    } catch (err) {
      console.error(
        `  ✗ failed row for ${plan.email}:`,
        (err as Error).message,
      );
      await prisma.issuedCertificate.create({
        data: {
          templateId: TEMPLATE_ID,
          receiverEmail: plan.email,
          issuerId,
          jobId: job.id,
          certificateName: CERTIFICATE_NAME,
          unitName: UNIT_NAME,
          description: DESCRIPTION,
          properties: plan.properties as unknown as object,
          assetId: plan.asset?.assetId,
          imageCid: plan.metadata?.imageCid,
          metadataCid: plan.metadata?.metadataCid,
          mintingStatus: plan.asset ? "MINTED" : "FAILED",
          status: "PENDING",
          mintTransactionHash: plan.asset?.mintTxnId ?? null,
          errorMessage: `Restore error: ${(err as Error).message}`,
        },
      });
      failed++;
    }
  }

  await prisma.bulkIssuanceJob.update({
    where: { id: job.id },
    data: {
      status: JobStatus.COMPLETED,
      processedItems: processed,
      failedItems: failed,
      statusMessages: {
        restoredBy: "scripts/restore-algohack-bulk.ts",
        extraAssetSweeps: extraSweeps as unknown as object,
      },
    },
  });

  console.log(
    `\nDone. processed=${processed} failed=${failed} extraAssetsSwept=${extraSweeps.length} jobId=${job.id}`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
