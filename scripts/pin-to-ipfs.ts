/**
 * Periodic CAR Pin Script: local backup -> our own IPFS node
 *
 * PURPOSE
 * -------
 * Picks up every IpfsPinRecord that has no IpfsPin row for "ipfs-node",
 * reads its CAR file from uploads/cars/, imports + pins it into the
 * configured IPFS (kubo) node via its HTTP RPC API, and creates an IpfsPin
 * row to mark it done.
 *
 * Designed to run on a schedule (e.g. every 5 minutes via cron/systemd
 * timer). Fully idempotent — already-pinned CIDs are skipped via the DB
 * query.
 *
 * USAGE
 * -----
 *   pnpm pin:ipfs
 *
 * REQUIRED ENV VARS
 * -----------------
 *   DATABASE_URL   – MySQL connection string
 *   IPFS_API_URL   – Base URL of the kubo RPC API (e.g. http://127.0.0.1:5001)
 */

import { config as loadEnv } from "dotenv";
loadEnv();

import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";

const PROVIDER = "ipfs-node";

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(process.cwd(), "uploads");
const CARS_DIR = path.join(UPLOADS_PATH, "cars");
const LOCK_FILE = path.join(CARS_DIR, ".pin-to-ipfs.lock");

const IPFS_API_URL = (process.env.IPFS_API_URL || "http://127.0.0.1:5001").replace(/\/+$/, "");

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

// ─── Pin a single CAR into the local node ─────────────────────────────────────

async function importCarToIpfsNode(carPath: string): Promise<void> {
  const carBytes = fs.readFileSync(carPath);
  const carBlob = new Blob([carBytes], { type: "application/vnd.ipld.car" });

  const form = new FormData();
  form.append("file", carBlob, path.basename(carPath));

  const res = await fetch(`${IPFS_API_URL}/api/v0/dag/import?pin-roots=true`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${await res.text()}`);
  }

  // Response is newline-delimited JSON; drain it so the connection closes cleanly.
  await res.text();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!acquireLock()) process.exit(0);

  // Records with no IpfsPin row for this provider
  const pending = await prisma.ipfsPinRecord.findMany({
    where: {
      pins: { none: { provider: PROVIDER } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) {
    console.log(`Nothing to do. Checked at: ${new Date().toISOString()}`);
    return;
  }

  console.log("=".repeat(60));
  console.log(`CAR Pin: local backup -> IPFS node`);
  console.log(`Started   : ${new Date().toISOString()}`);
  console.log("=".repeat(60));
  console.log(`Cars dir  : ${CARS_DIR}`);
  console.log(`IPFS node : ${IPFS_API_URL}`);
  console.log(`\nPending pins: ${pending.length}`);

  let pinned = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < pending.length; i++) {
    const record = pending[i];
    const carPath = path.join(CARS_DIR, `${record.cid}.car`);
    const prefix = `[${i + 1}/${pending.length}] ${record.cid}`;

    if (!fs.existsSync(carPath)) {
      console.log(`${prefix} — SKIP (CAR file not found)`);
      skipped++;
      continue;
    }

    process.stdout.write(`${prefix} — pinning ... `);
    try {
      await importCarToIpfsNode(carPath);

      await prisma.ipfsPin.create({
        data: { recordId: record.id, provider: PROVIDER },
      });

      console.log("OK");
      pinned++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Pinned   : ${pinned}`);
  console.log(`Failed   : ${failed}`);
  console.log(`Skipped  : ${skipped}`);
  console.log(`Ended    : ${new Date().toISOString()}`);

  if (failed > 0) {
    console.log("\nRe-run to retry failed pins.");
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
