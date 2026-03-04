/**
 * IPFS Provider Migration Script: Pinata → Storacha
 *
 * PURPOSE
 * -------
 * Ensures every image/metadata CID stored in the database is:
 *   1. Backed up locally as a CAR file in uploads/ipfs-backup/
 *   2. Pinned in the configured Storacha space
 *
 * The script is idempotent – already-backed-up and already-pinned CIDs are
 * skipped, so it is safe to re-run after partial failures.
 *
 * USAGE
 * -----
 *   pnpm migrate:ipfs
 *
 * REQUIRED ENV VARS
 * -----------------
 *   DATABASE_URL          – MySQL connection string
 *   STORACHA_PRINCIPAL    – base64-encoded Ed25519 key  (storacha key create)
 *   STORACHA_PROOF        – base64-encoded delegation   (storacha delegation create)
 *
 * OPTIONAL ENV VARS
 * -----------------
 *   IPFS_GATEWAY          – IPFS gateway URL including the /ipfs path prefix
 *                           Trailing slash is optional (both forms are accepted)
 *                           Defaults to: https://ipfs.io/ipfs
 *                           e.g. https://ipfs.io/ipfs  or  https://ipfs.io/ipfs/
 *   UPLOADS_PATH          – Absolute path to the uploads directory
 *                           Defaults to: {cwd}/uploads
 */

import { config as loadEnv } from "dotenv";
loadEnv(); // must run before any import that reads process.env

import path from "path";
import fs from "fs";
import { CID } from "multiformats/cid";
import prisma from "@/lib/prisma";
import { createStorachaClient } from "@/lib/storacha";

// ─── Config ──────────────────────────────────────────────────────────────────

// Gateway must include the /ipfs path prefix, e.g. https://ipfs.io/ipfs
// Trailing slash is stripped so we can safely append /{cid}
const IPFS_GATEWAY = (
  process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs"
).replace(/\/+$/, "");

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(process.cwd(), "uploads");

const BACKUP_DIR = path.join(UPLOADS_PATH, "ipfs-backup");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize any CID string to its CIDv1 base32 representation so that
 * CIDv0 strings ("Qm…") and CIDv1 strings ("bafy…") for the same content
 * compare equal.
 */
function normalizeCid(cidStr: string): string {
  try {
    return CID.parse(cidStr).toV1().toString();
  } catch {
    return cidStr;
  }
}

// ─── Step 1: Collect CIDs from the database ──────────────────────────────────

interface CollectResult {
  allCids: string[];
  badgeCidCount: number;
  certCidCount: number;
}

async function collectCidsFromDb(): Promise<CollectResult> {
  const [badges, certs] = await Promise.all([
    prisma.badge.findMany({ select: { imageCid: true, metadataCid: true } }),
    prisma.issuedCertificate.findMany({
      select: { imageCid: true, metadataCid: true },
    }),
  ]);

  const cidSet = new Set<string>();

  let badgeCidCount = 0;
  for (const badge of badges) {
    if (badge.imageCid) {
      cidSet.add(badge.imageCid);
      badgeCidCount++;
    }
    if (badge.metadataCid) {
      cidSet.add(badge.metadataCid);
      badgeCidCount++;
    }
  }

  let certCidCount = 0;
  for (const cert of certs) {
    if (cert.imageCid) {
      cidSet.add(cert.imageCid);
      certCidCount++;
    }
    if (cert.metadataCid) {
      cidSet.add(cert.metadataCid);
      certCidCount++;
    }
  }

  return {
    allCids: Array.from(cidSet),
    badgeCidCount,
    certCidCount,
  };
}

// ─── Step 2: Scan local backup directory ────────────────────────────────────

/**
 * Returns a Set containing both the raw filename stem and its normalized v1
 * form for every .car file already present in the backup directory.
 */
function getLocalBackupCids(backupDir: string): Set<string> {
  if (!fs.existsSync(backupDir)) return new Set();

  const cids = new Set<string>();
  for (const file of fs.readdirSync(backupDir)) {
    if (!file.endsWith(".car")) continue;
    const stem = file.slice(0, -4); // strip .car
    cids.add(stem);
    cids.add(normalizeCid(stem));
  }
  return cids;
}

// ─── Step 3: List all CIDs already uploaded to Storacha ─────────────────────

type StorachaClient = Awaited<ReturnType<typeof createStorachaClient>>;

/**
 * Paginates through capability.upload.list and returns a Set of every root
 * CID (raw + normalized) registered in the current Storacha space.
 */
async function getAllStorachaCids(client: StorachaClient): Promise<Set<string>> {
  const cids = new Set<string>();
  let cursor: string | undefined;

  do {
    const page = await client.capability.upload.list({ cursor, size: 100 });
    for (const upload of page.results) {
      const raw = upload.root.toString();
      cids.add(raw);
      cids.add(normalizeCid(raw));
    }
    cursor = page.cursor;
  } while (cursor);

  return cids;
}

// ─── Backup validation ───────────────────────────────────────────────────────

/**
 * A valid CAR v1 file starts with a varint-prefixed CBOR header — its first
 * byte is never 0x3c ('<'). HTML responses start with '<', so this one-byte
 * check reliably detects corrupt HTML files saved from gateway redirect pages.
 */
function isValidCarFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(1);
    fs.readSync(fd, buf, 0, 1, 0);
    fs.closeSync(fd);
    return buf[0] !== 0x3c; // not '<'
  } catch {
    return false;
  }
}

/**
 * Walk the backup directory and delete any .car file whose content is HTML
 * (i.e. was saved from a gateway redirect/error page). Returns count removed.
 */
function purgeCorruptCarFiles(backupDir: string): number {
  if (!fs.existsSync(backupDir)) return 0;
  let removed = 0;
  for (const file of fs.readdirSync(backupDir)) {
    if (!file.endsWith(".car")) continue;
    const filePath = path.join(backupDir, file);
    if (!isValidCarFile(filePath)) {
      fs.rmSync(filePath);
      console.log(`  🗑️  Removed corrupt file: ${file}`);
      removed++;
    }
  }
  return removed;
}

// ─── Step 4: Download a CAR file from the public IPFS gateway ───────────────

async function downloadCar(
  cid: string,
  destPath: string,
  gateway: string
): Promise<void> {
  const url = `${gateway}/${cid}?format=car`;
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.ipld.car" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/vnd.ipld.car")) {
    throw new Error(
      `Gateway returned unexpected content-type "${contentType}" for ${cid}. ` +
        `Expected application/vnd.ipld.car. Try a different IPFS_GATEWAY.`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

// ─── Step 5: Upload a CAR file to Storacha ──────────────────────────────────

async function uploadCarToStoracha(
  client: StorachaClient,
  carPath: string
): Promise<string> {
  const carBytes = fs.readFileSync(carPath);
  const carBlob = new Blob([carBytes], { type: "application/vnd.ipld.car" });
  const rootCid = await client.uploadCAR(carBlob);
  return rootCid.toString();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 IPFS Provider Migration: Pinata → Storacha");
  console.log("=".repeat(60));
  console.log(`📁 Backup dir : ${BACKUP_DIR}`);
  console.log(`🌐 Gateway    : ${IPFS_GATEWAY}/{cid}?format=car`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // ── Purge any corrupt (HTML) .car files from a previous bad run ──────────
  const purged = purgeCorruptCarFiles(BACKUP_DIR);
  if (purged > 0) {
    console.log(`🧹 Removed ${purged} corrupt CAR file(s) — they will be re-downloaded.`);
  }

  // ── Init Storacha client ─────────────────────────────────────────────────
  console.log("\n[1/5] Initializing Storacha client...");
  const client = await createStorachaClient();
  const spaceDid = client.currentSpace()?.did() ?? "(unknown)";
  console.log(`✅ Connected to space: ${spaceDid}`);

  // ── Collect CIDs from DB ─────────────────────────────────────────────────
  console.log("\n[2/5] Collecting CIDs from database...");
  const { allCids, badgeCidCount, certCidCount } = await collectCidsFromDb();
  console.log(`  Badge CIDs        : ${badgeCidCount}`);
  console.log(`  Certificate CIDs  : ${certCidCount}`);
  console.log(`  Total unique CIDs : ${allCids.length}`);

  if (allCids.length === 0) {
    console.log("\n⚠️  No CIDs found in database. Nothing to do.");
    return;
  }

  // ── Check local backup ───────────────────────────────────────────────────
  console.log("\n[3/5] Checking local backup...");
  const localCids = getLocalBackupCids(BACKUP_DIR);

  const missingFromLocal = allCids.filter(
    (cid) => !localCids.has(cid) && !localCids.has(normalizeCid(cid))
  );
  console.log(`  Already backed up  : ${localCids.size / 2}`); // divided by 2 because we store raw + normalized
  console.log(`  Missing from backup: ${missingFromLocal.length}`);

  // ── Check Storacha ───────────────────────────────────────────────────────
  console.log("\n[4/5] Checking Storacha uploads (paginating)...");
  const storachaCids = await getAllStorachaCids(client);

  const missingFromStoracha = allCids.filter((cid) => {
    const v1 = normalizeCid(cid);
    return !storachaCids.has(cid) && !storachaCids.has(v1);
  });
  console.log(
    `  Already in Storacha    : ${storachaCids.size / 2}` // raw + normalized entries
  );
  console.log(`  Missing from Storacha  : ${missingFromStoracha.length}`);

  // ── Download missing CAR files ───────────────────────────────────────────
  console.log("\n[5a/5] Downloading missing CAR files from IPFS gateway...");

  let downloaded = 0;
  let downloadFailed = 0;

  if (missingFromLocal.length === 0) {
    console.log("  ✅ All CIDs already backed up locally, skipping downloads.");
  }

  let index = 0;
  for (const cid of missingFromLocal) {
    const carPath = path.join(BACKUP_DIR, `${cid}.car`);
    process.stdout.write(`  ⬇️  ${index + 1}/${missingFromLocal.length} ${cid} ... `);
    try {
      await downloadCar(cid, carPath, IPFS_GATEWAY);
      console.log("✅");
      downloaded++;
    } catch (err: any) {
      console.log(`❌  ${err.message}`);
      downloadFailed++;
    }
    index++;
  }

  // ── Upload missing CIDs to Storacha ──────────────────────────────────────
  console.log("\n[5b/5] Uploading missing CIDs to Storacha...");

  let uploaded = 0;
  let uploadFailed = 0;
  let uploadSkipped = 0;

  if (missingFromStoracha.length === 0) {
    console.log("  ✅ All CIDs already pinned in Storacha, skipping uploads.");
  }

  let uploadIndex = 0;
  for (const cid of missingFromStoracha) {
    const carPath = path.join(BACKUP_DIR, `${cid}.car`);

    if (!fs.existsSync(carPath)) {
      console.log(`  ⚠️  ${uploadIndex + 1}/${missingFromStoracha.length} Skipping ${cid} — CAR not in backup (download may have failed)`);
      uploadSkipped++;
      uploadIndex++;
      continue;
    }

    process.stdout.write(`  ⬆️  ${uploadIndex + 1}/${missingFromStoracha.length} ${cid} ... `);
    try {
      const rootCid = await uploadCarToStoracha(client, carPath);
      console.log(`✅  (registered root: ${rootCid})`);
      uploaded++;
    } catch (err: any) {
      console.log(`❌  ${err.message}`);
      uploadFailed++;
    }
    uploadIndex++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalBackedUp = localCids.size / 2 + downloaded;
  const totalInStoracha = storachaCids.size / 2 + uploaded;

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));
  console.log(`Total unique CIDs in DB        : ${allCids.length}`);
  console.log(`CIDs backed up locally (total) : ${totalBackedUp}`);
  console.log(`CIDs pinned in Storacha (total): ${totalInStoracha}`);
  console.log("");
  console.log(`Downloaded this run            : ${downloaded}`);
  console.log(`Download failures              : ${downloadFailed}`);
  console.log(`Uploaded this run              : ${uploaded}`);
  console.log(`Upload failures                : ${uploadFailed}`);
  console.log(`Upload skipped (no CAR)        : ${uploadSkipped}`);

  if (downloadFailed > 0 || uploadFailed > 0) {
    console.log(
      "\n⚠️  Some CIDs could not be processed. Re-run the script to retry."
    );
    process.exit(1);
  }

  console.log("\n🎉 Migration complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n💥 Unexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
