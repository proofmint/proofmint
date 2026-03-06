/**
 * Periodic CAR Upload Script: local backup → Storacha
 *
 * PURPOSE
 * -------
 * Picks up every IpfsPinRecord that has no IpfsPin row for "storacha",
 * reads its CAR file from uploads/ipfs-backup/, uploads it via uploadCAR,
 * and creates an IpfsPin row to mark it done.
 *
 * Designed to run on a cron schedule (e.g. every 5 minutes).
 * Fully idempotent — already-pinned CIDs are skipped via the DB query.
 *
 * USAGE
 * -----
 *   pnpm upload:cars
 *
 * REQUIRED ENV VARS
 * -----------------
 *   DATABASE_URL       – MySQL connection string
 *   STORACHA_PRINCIPAL – base64-encoded Ed25519 key  (storacha key create)
 *   STORACHA_PROOF     – base64-encoded delegation   (storacha delegation create)
 */

import { config as loadEnv } from "dotenv";
loadEnv();

import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { createStorachaClient } from "@/lib/storacha";

const PROVIDER = "storacha";

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(process.cwd(), "uploads");
const BACKUP_DIR = path.join(UPLOADS_PATH, "ipfs-backup");
const LOCK_FILE = path.join(BACKUP_DIR, ".upload-cars.lock");

// ─── Lock helpers ─────────────────────────────────────────────────────────────

function acquireLock(): boolean {
  // If lock file exists, check whether the recorded PID is still alive
  if (fs.existsSync(LOCK_FILE)) {
    const pid = parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0); // throws if process is dead
        console.log(`Another instance is already running (PID ${pid}). Exiting.`);
        return false;
      } catch {
        // Stale lock — previous run crashed without cleaning up
        console.log(`Removing stale lock file (PID ${pid} is no longer running).`);
      }
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  return true;
}

function releaseLock(): void {
  try { fs.rmSync(LOCK_FILE); } catch { /* already gone */ }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!acquireLock()) process.exit(0);

  console.log("=".repeat(60));
  console.log("CAR Upload: local backup → Storacha");
  console.log("=".repeat(60));
  console.log(`Backup dir: ${BACKUP_DIR}`);

  // Records with no IpfsPin row for this provider
  const pending = await prisma.ipfsPinRecord.findMany({
    where: {
      pins: { none: { provider: PROVIDER } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nPending uploads: ${pending.length}`);

  if (pending.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const client = await createStorachaClient();
  console.log(`Storacha space : ${client.currentSpace()?.did() ?? "(unknown)"}\n`);

  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < pending.length; i++) {
    const record = pending[i];
    const carPath = path.join(BACKUP_DIR, `${record.cid}.car`);
    const prefix = `[${i + 1}/${pending.length}] ${record.cid}`;

    if (!fs.existsSync(carPath)) {
      console.log(`${prefix} — SKIP (CAR file not found)`);
      skipped++;
      continue;
    }

    process.stdout.write(`${prefix} — uploading ... `);
    try {
      const carBytes = fs.readFileSync(carPath);
      const carBlob = new Blob([carBytes], { type: "application/vnd.ipld.car" });
      await client.uploadCAR(carBlob);

      await prisma.ipfsPin.create({
        data: { recordId: record.id, provider: PROVIDER },
      });

      console.log("OK");
      uploaded++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Uploaded : ${uploaded}`);
  console.log(`Failed   : ${failed}`);
  console.log(`Skipped  : ${skipped}`);

  if (failed > 0) {
    console.log("\nRe-run to retry failed uploads.");
    process.exit(1);
  }
}

// Release lock on clean exit, crash, or SIGINT/SIGTERM
process.on("exit", releaseLock);
process.on("SIGINT", () => process.exit(1));
process.on("SIGTERM", () => process.exit(1));

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
