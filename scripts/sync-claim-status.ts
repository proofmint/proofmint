/**
 * Sync claimed status for IssuedBadge and IssuedCertificate records.
 *
 * Finds records the DB still shows as PENDING, checks whether the
 * on-chain ASA transfer (claim txn) has already happened, and
 * updates status/claimedAt/transactionHash accordingly.
 *
 * Also supports recovering claim-link badges where the on-chain txn
 * succeeded but the DB write never completed (--recover-claim-links).
 *
 * Usage:
 *   npx tsx scripts/sync-claim-status.ts [--dry-run] [--badges-only] [--certs-only]
 *   npx tsx scripts/sync-claim-status.ts --recover-claim-links [--dry-run]
 */

import prisma from "@/lib/prisma";
import { getWallet } from "@/lib/vault";
import { cleanString, getHash } from "@/lib/utils";
import { VAULT_HOST, VAULT_TOKEN } from "@/lib/const";
import { Indexer } from "algosdk";
import algosdk from "algosdk";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Read an existing Vault transit key via GET — does NOT create the key.
 * Returns null if the key doesn't exist or on any error.
 */
async function getExistingWallet(email: string): Promise<string | null> {
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

/**
 * Get the receiver's wallet address without creating anything.
 * Priority: DB User record → Vault GET (read-only).
 * Returns null if neither source has the key (user never registered).
 */
async function getReceiverWallet(email: string): Promise<string | null> {
  const normalized = cleanString(email);
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { walletAddress: true },
  });
  if (existing) return existing.walletAddress;
  return getExistingWallet(normalized);
}

/**
 * Create the Vault key + stub RECEIVER User record.
 * Call this ONLY after confirming an on-chain claim exists.
 */
async function createUserWithWallet(email: string): Promise<string | null> {
  const normalized = cleanString(email);

  // Check DB first — may already exist from a concurrent run
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { walletAddress: true },
  });
  if (existing) return existing.walletAddress;

  // Create the Vault key and derive the wallet address
  const walletAddress = await getWallet(getHash(normalized));
  if (!walletAddress) {
    console.log(`    Vault key creation failed for ${normalized}`);
    return null;
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  await prisma.user.create({
    data: {
      email: normalized,
      fullName: "",
      organizationName: "",
      passwordHash,
      role: "RECEIVER",
      walletAddress,
      emailVerified: false,
    },
  });

  console.log(`    created stub account for ${normalized} (wallet ${walletAddress})`);
  return walletAddress;
}

const DRY_RUN = process.argv.includes("--dry-run");
const BADGES_ONLY = process.argv.includes("--badges-only");
const CERTS_ONLY = process.argv.includes("--certs-only");
const RECOVER_CLAIM_LINKS = process.argv.includes("--recover-claim-links");

const INDEXER_URL =
  process.env.ALGORAND_NETWORK === "testnet"
    ? "https://testnet-idx.4160.nodely.dev"
    : "https://mainnet-idx.4160.nodely.dev";

const indexer = new Indexer("a".repeat(64), INDEXER_URL, 443);

// Rate-limit helper — Nodely free tier allows ~10 req/s
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Look up the first asset-transfer transaction of `assetId` where
 * sender=`issuerWallet` and receiver=`receiverWallet` (amount=1).
 */
async function findClaimTxn(
  assetId: string,
  issuerWallet: string,
  receiverWallet: string
): Promise<{ txnId: string; claimedAt: Date } | null> {
  try {
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

      if (nextToken) query = (query as any).nextToken(nextToken);

      const result = await query.do();

      for (const txn of result.transactions ?? []) {
        if (
          txn.assetTransferTransaction?.receiver === receiverWallet &&
          txn.id &&
          txn.roundTime
        ) {
          return {
            txnId: txn.id as string,
            claimedAt: new Date((txn.roundTime as number) * 1000),
          };
        }
      }

      if (result.nextToken) {
        nextToken = result.nextToken as string;
      } else {
        break;
      }
    }

    return null;
  } catch (err) {
    console.error(`    indexer error for asset ${assetId}:`, (err as Error).message);
    return null;
  }
}

/**
 * Fetch ALL asset-transfer txns (amount=1) sent from `issuerWallet`
 * for `assetId`, returning every receiver address found on-chain.
 * Used for claim-link recovery where we don't know the receiver upfront.
 */
async function findAllClaimTxns(
  assetId: string,
  issuerWallet: string
): Promise<Array<{ receiverAddress: string; txnId: string; claimedAt: Date }>> {
  const results: Array<{ receiverAddress: string; txnId: string; claimedAt: Date }> = [];

  try {
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

      if (nextToken) query = (query as any).nextToken(nextToken);

      const result = await query.do();

      for (const txn of result.transactions ?? []) {
        const receiver = txn.assetTransferTransaction?.receiver;
        if (receiver && txn.id && txn.roundTime) {
          results.push({
            receiverAddress: receiver as string,
            txnId: txn.id as string,
            claimedAt: new Date((txn.roundTime as number) * 1000),
          });
        }
      }

      if (result.nextToken) {
        nextToken = result.nextToken as string;
      } else {
        break;
      }
    }
  } catch (err) {
    console.error(`    indexer error for asset ${assetId}:`, (err as Error).message);
  }

  return results;
}

// ─── Claim-link recovery ──────────────────────────────────────────────────────

async function recoverClaimLinks() {
  console.log("\n── Claim-link recovery ───────────────────────────────────");
  console.log("Looking for on-chain claims with no matching DB record…\n");

  const claimLinks = await prisma.badgeClaimLink.findMany({
    where: { isActive: true },
    select: {
      id: true,
      badge: {
        select: {
          id: true,
          assetId: true,
        },
      },
      issuer: {
        select: {
          id: true,
          user: { select: { walletAddress: true } },
        },
      },
      issuedBadges: {
        select: { receiverEmail: true, transactionHash: true },
      },
      createdAt: true,
    },
  });

  console.log(`Found ${claimLinks.length} active claim link(s)`);

  // Build wallet→email map from existing DB User records only — no Vault calls.
  // For missing users, getExistingWallet (read-only GET) is used per claim below.
  const dbUsers = await prisma.user.findMany({
    select: { email: true, walletAddress: true },
  });
  const walletToEmail = new Map(dbUsers.map((u) => [u.walletAddress, u.email]));

  console.log(`  Wallet map built from DB: ${walletToEmail.size} known user(s)\n`);

  let created = 0;
  let alreadyPresent = 0;
  let unrecognized = 0;

  for (let i = 0; i < claimLinks.length; i++) {
    const link = claimLinks[i];
    console.log(
      `  [${i + 1}/${claimLinks.length}] claim link ${link.id} (badge assetId ${link.badge.assetId})`
    );

    const onChainTxns = await findAllClaimTxns(
      link.badge.assetId,
      link.issuer.user.walletAddress
    );

    console.log(`    ${onChainTxns.length} on-chain transfer(s) found`);

    // Set of emails that already have a DB record for this link
    const existingEmails = new Set(link.issuedBadges.map((b) => b.receiverEmail));
    // Set of txn hashes already recorded (to avoid duplicate detection by txnId)
    const existingTxnHashes = new Set(
      link.issuedBadges.map((b) => b.transactionHash).filter(Boolean)
    );

    for (const txn of onChainTxns) {
      // Skip if we already recorded this exact txn
      if (existingTxnHashes.has(txn.txnId)) {
        alreadyPresent++;
        continue;
      }

      const email = walletToEmail.get(txn.receiverAddress);

      if (!email) {
        console.log(
          `    UNRECOGNIZED wallet ${txn.receiverAddress} (txn ${txn.txnId}) — not in DB, cannot map to email`
        );
        unrecognized++;
        continue;
      }

      if (existingEmails.has(email)) {
        // Record exists but txn hash may differ (handled by syncBadges)
        alreadyPresent++;
        continue;
      }

      console.log(
        `    MISSING record for ${email} — txn ${txn.txnId}${DRY_RUN ? " (dry-run)" : ""}`
      );

      if (!DRY_RUN) {
        // Claim confirmed — now safe to create wallet key + user record if missing
        await createUserWithWallet(email);
        await prisma.$transaction([
          prisma.issuedBadge.create({
            data: {
              badgeId: link.badge.id,
              receiverEmail: email,
              issuerId: link.issuer.id,
              claimLinkId: link.id,
              status: "CLAIMED",
              issuedAt: link.createdAt,
              claimedAt: txn.claimedAt,
              transactionHash: txn.txnId,
            },
          }),
          prisma.badgeClaimLink.update({
            where: { id: link.id },
            data: { claimCount: { increment: 1 } },
          }),
        ]);
      }

      existingEmails.add(email);
      existingTxnHashes.add(txn.txnId);
      created++;
    }

    await sleep(300); // extra pause between claim links (each may page through many txns)
  }

  console.log(
    `\nClaim-link recovery done: ${created} record(s) created, ${alreadyPresent} already present, ${unrecognized} unrecognized wallet(s)`
  );
}

// ─── Certificates ────────────────────────────────────────────────────────────

async function syncCertificates() {
  console.log("\n── Certificates ──────────────────────────────────────────");

  const certs = await prisma.issuedCertificate.findMany({
    where: {
      mintingStatus: "MINTED",
      status: "PENDING",
      assetId: { not: null },
    },
    select: {
      id: true,
      assetId: true,
      receiverEmail: true,
      issuer: {
        select: {
          user: { select: { walletAddress: true } },
        },
      },
    },
  });

  console.log(`Found ${certs.length} MINTED + PENDING certificate(s)`);

  let claimed = 0;
  let pending = 0;
  let skipped = 0;

  for (let i = 0; i < certs.length; i++) {
    const cert = certs[i];
    process.stdout.write(
      `  [${i + 1}/${certs.length}] cert ${cert.id} (${cert.receiverEmail}) … `
    );

    const receiverWallet = await getReceiverWallet(cert.receiverEmail);

    if (!receiverWallet) {
      console.log("SKIP (no Vault key — user never registered)");
      skipped++;
      continue;
    }

    const txn = await findClaimTxn(
      cert.assetId!,
      cert.issuer.user.walletAddress,
      receiverWallet
    );

    if (txn) {
      if (!DRY_RUN) {
        await createUserWithWallet(cert.receiverEmail);
        await prisma.issuedCertificate.update({
          where: { id: cert.id },
          data: {
            status: "CLAIMED",
            claimedAt: txn.claimedAt,
            claimTransactionHash: txn.txnId,
          },
        });
      }
      console.log(`CLAIMED${DRY_RUN ? " (dry-run)" : ""} → ${txn.txnId}`);
      claimed++;
    } else {
      console.log("not yet claimed on-chain");
      pending++;
    }

    await sleep(150);
  }

  console.log(
    `Certificates done: ${claimed} claimed, ${pending} still pending, ${skipped} skipped`
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────

async function syncBadges() {
  console.log("\n── Badges ────────────────────────────────────────────────");

  const issuedBadges = await prisma.issuedBadge.findMany({
    where: {
      status: "PENDING",
      transactionHash: null,
    },
    select: {
      id: true,
      receiverEmail: true,
      badge: { select: { assetId: true } },
      issuer: {
        select: {
          user: { select: { walletAddress: true } },
        },
      },
    },
  });

  console.log(`Found ${issuedBadges.length} PENDING badge(s) with no txn hash`);

  let claimed = 0;
  let pending = 0;
  let skipped = 0;

  for (let i = 0; i < issuedBadges.length; i++) {
    const badge = issuedBadges[i];
    process.stdout.write(
      `  [${i + 1}/${issuedBadges.length}] badge ${badge.id} (${badge.receiverEmail}) … `
    );

    const receiverWallet = await getReceiverWallet(badge.receiverEmail);

    if (!receiverWallet) {
      console.log("SKIP (no Vault key — user never registered)");
      skipped++;
      continue;
    }

    const txn = await findClaimTxn(
      badge.badge.assetId,
      badge.issuer.user.walletAddress,
      receiverWallet
    );

    if (txn) {
      if (!DRY_RUN) {
        await createUserWithWallet(badge.receiverEmail);
        await prisma.issuedBadge.update({
          where: { id: badge.id },
          data: {
            status: "CLAIMED",
            claimedAt: txn.claimedAt,
            transactionHash: txn.txnId,
          },
        });
      }
      console.log(`CLAIMED${DRY_RUN ? " (dry-run)" : ""} → ${txn.txnId}`);
      claimed++;
    } else {
      console.log("not yet claimed on-chain");
      pending++;
    }

    await sleep(150);
  }

  console.log(
    `Badges done: ${claimed} claimed, ${pending} still pending, ${skipped} skipped`
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const network = process.env.ALGORAND_NETWORK ?? "mainnet";
  console.log(
    `Syncing claim status [network=${network}]${DRY_RUN ? " [DRY RUN]" : ""}`
  );

  if (RECOVER_CLAIM_LINKS) {
    await recoverClaimLinks();
  } else {
    if (!BADGES_ONLY) await syncCertificates();
    if (!CERTS_ONLY) await syncBadges();
  }

  console.log("\nAll done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
