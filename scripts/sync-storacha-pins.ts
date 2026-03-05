/**
 * Sync Storacha Pin Records
 *
 * PURPOSE
 * -------
 * Pages through every upload in the configured Storacha space and ensures
 * the local IpfsPinRecord + IpfsPin tables reflect what is actually pinned.
 *
 * For each CID returned by Storacha:
 *   - If no IpfsPinRecord exists → create it
 *   - If no IpfsPin row for "storacha" exists → create it
 *
 * Idempotent — safe to re-run. Useful after:
 *   - Manually uploading CARs to Storacha outside this app
 *   - Running the old migrate-ipfs-provider.ts script (which didn't write IpfsPin rows)
 *   - Recovering from a DB wipe where pin records were lost
 *
 * USAGE
 * -----
 *   pnpm sync:pins
 *
 * REQUIRED ENV VARS
 * -----------------
 *   DATABASE_URL       – MySQL connection string
 *   STORACHA_PRINCIPAL – base64-encoded Ed25519 key  (storacha key create)
 *   STORACHA_PROOF     – base64-encoded delegation   (storacha delegation create)
 */

import { config as loadEnv } from "dotenv";
loadEnv();

import prisma from "@/lib/prisma";
import { createStorachaClient } from "@/lib/storacha";

const PROVIDER = "storacha";

async function main() {
  console.log("=".repeat(60));
  console.log("Sync Storacha → IpfsPinRecord / IpfsPin tables");
  console.log("=".repeat(60));

  const client = await createStorachaClient();
  console.log(`Storacha space: ${client.currentSpace()?.did() ?? "(unknown)"}\n`);

  // ── Collect CIDs referenced in badges and certificates ───────────────────
  console.log("Collecting CIDs from database...");
  const [badges, certs] = await Promise.all([
    prisma.badge.findMany({ select: { imageCid: true, metadataCid: true } }),
    prisma.issuedCertificate.findMany({ select: { imageCid: true, metadataCid: true } }),
  ]);

  const dbCids = new Set<string>();
  for (const b of badges) {
    if (b.imageCid) dbCids.add(b.imageCid);
    if (b.metadataCid) dbCids.add(b.metadataCid);
  }
  for (const c of certs) {
    if (c.imageCid) dbCids.add(c.imageCid);
    if (c.metadataCid) dbCids.add(c.metadataCid);
  }
  console.log(`  ${dbCids.size} unique CIDs in badges/certificates\n`);

  if (dbCids.size === 0) {
    console.log("Nothing to sync.");
    return;
  }

  // ── Page through Storacha, keep only CIDs that are in the DB ─────────────
  console.log("Fetching uploads from Storacha (paginating)...");
  const storachaCids: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await client.capability.upload.list({ cursor, size: 100 });
    for (const upload of page.results) {
      const cid = upload.root.toString();
      if (dbCids.has(cid)) storachaCids.push(cid);
    }
    cursor = page.cursor;
    process.stdout.write(`\r  Checked uploads, matched ${storachaCids.length} so far...`);
  } while (cursor);

  console.log(`\n  ${storachaCids.length} matched CIDs found in Storacha\n`);

  if (storachaCids.length === 0) {
    console.log("Nothing to sync.");
    return;
  }

  // ── Load existing DB state ────────────────────────────────────────────────
  const existingRecords = await prisma.ipfsPinRecord.findMany({
    where: { cid: { in: storachaCids } },
    include: { pins: { where: { provider: PROVIDER } } },
  });

  const recordMap = new Map(existingRecords.map((r) => [r.cid, r]));

  // ── Reconcile ─────────────────────────────────────────────────────────────
  let created = 0;
  let pinned = 0;
  let alreadyOk = 0;

  for (const cid of storachaCids) {
    const existing = recordMap.get(cid);

    if (!existing) {
      // Create both IpfsPinRecord and IpfsPin in one transaction
      await prisma.ipfsPinRecord.create({
        data: {
          cid,
          pins: { create: { provider: PROVIDER } },
        },
      });
      created++;
    } else if (existing.pins.length === 0) {
      // Record exists but no pin row for storacha yet
      await prisma.ipfsPin.create({
        data: { recordId: existing.id, provider: PROVIDER },
      });
      pinned++;
    } else {
      alreadyOk++;
    }
  }

  console.log("=".repeat(60));
  console.log(`Already up to date : ${alreadyOk}`);
  console.log(`Records created    : ${created}`);
  console.log(`Pin rows added     : ${pinned}`);
  console.log(`Total synced       : ${storachaCids.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
