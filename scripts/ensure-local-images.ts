/**
 * Ensure Local Images & CAR Backups
 *
 * For every image CID in the database:
 *   1. Download missing CAR backups from the IPFS gateway
 *   2. Extract the image from the CAR file
 *   3. Fall back to direct gateway download only if CAR extraction fails
 *
 * Idempotent — safe to re-run. Intended for periodic cron execution.
 *
 * USAGE
 * -----
 *   pnpm ensure-images
 *
 * REQUIRED ENV VARS
 * -----------------
 *   DATABASE_URL   – MySQL connection string
 *   UPLOADS_PATH   – Absolute path to the uploads directory
 *
 * OPTIONAL ENV VARS
 * -----------------
 *   NEXT_PUBLIC_IPFS_GATEWAY   – Gateway URL with /ipfs prefix (default: https://ipfs.io/ipfs)
 */

import { config as loadEnv } from "dotenv";
loadEnv();

import path from "path";
import fs from "fs";
import { CarReader } from "@ipld/car";
import { exporter } from "ipfs-unixfs-exporter";
import { CID } from "multiformats/cid";
import prisma from "@/lib/prisma";

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(process.cwd(), "uploads");
const BADGES_PATH = path.join(UPLOADS_PATH, "badges");
const CERTIFICATES_PATH = path.join(UPLOADS_PATH, "certificates");
const BACKUP_DIR = path.join(UPLOADS_PATH, "ipfs-backup");
const IPFS_GATEWAY = (
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs"
).replace(/\/+$/, "");

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findLocalFile(dir: string, cid: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const match = files.find((f) => path.parse(f).name === cid);
  return match ? path.join(dir, match) : null;
}

/**
 * Download a CAR file from the IPFS gateway and save to BACKUP_DIR.
 * Returns true on success.
 */
async function downloadCar(cid: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${IPFS_GATEWAY}/${cid}?format=car`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.ipld.car" },
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    // Validate: CAR files don't start with '<' (HTML error pages do)
    if (buffer.length === 0 || buffer[0] === 0x3c) {
      return { ok: false, error: "Gateway returned HTML instead of CAR" };
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUP_DIR, `${cid}.car`), buffer);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Extract the raw image bytes from a CAR file using ipfs-unixfs-exporter.
 * Handles raw blocks, single-block UnixFS files, and chunked UnixFS files.
 *
 * Returns null if extraction fails.
 */
async function extractImageFromCar(carPath: string): Promise<Buffer | null> {
  try {
    const reader = await CarReader.fromIterable(fs.createReadStream(carPath));
    const roots = await reader.getRoots();
    if (roots.length === 0) return null;

    const blockstore = {
      async *get(cid: CID) {
        const block = await reader.get(cid);
        if (!block) throw new Error(`Block not found: ${cid}`);
        yield block.bytes;
      },
    };

    const entry = await exporter(roots[0], blockstore as any);
    if (entry.type !== "file" && entry.type !== "raw") return null;

    const chunks: Uint8Array[] = [];
    for await (const chunk of entry.content()) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err: any) {
    console.error(`Failed to extract image from CAR file: ${carPath}`);
    console.error(err);
    return null;
  }
}

/**
 * Detect image MIME type from the first few bytes (magic bytes).
 */
function detectExt(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "gif";
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45
  )
    return "webp";
  if (buffer.slice(0, 4).toString() === "<svg") return "svg";
  return "bin";
}

/**
 * Fall back: download raw image from IPFS gateway.
 */
async function downloadRawImage(
  cid: string,
  destDir: string
): Promise<{ ok: boolean; error?: string }> {
  const url = `${IPFS_GATEWAY}/${cid}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const contentType = response.headers.get("content-type") || "image/png";
    const ext =
      MIME_TO_EXT[contentType.split(";")[0].trim()] || "bin";
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, `${cid}.${ext}`), buffer);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Ensure Local Images & CAR Backups");
  console.log("=".repeat(50));
  console.log(`Badges dir      : ${BADGES_PATH}`);
  console.log(`Certificates dir: ${CERTIFICATES_PATH}`);
  console.log(`Backup dir      : ${BACKUP_DIR}`);
  console.log(`IPFS gateway    : ${IPFS_GATEWAY}`);

  // Collect CIDs from DB
  const [badges, certs] = await Promise.all([
    prisma.badge.findMany({ select: { imageCid: true, metadataCid: true } }),
    prisma.issuedCertificate.findMany({
      select: { imageCid: true, metadataCid: true },
    }),
  ]);

  const badgeImageCids = new Set<string>();
  const certImageCids = new Set<string>();
  const allCids = new Set<string>();

  for (const badge of badges) {
    if (badge.imageCid) { badgeImageCids.add(badge.imageCid); allCids.add(badge.imageCid); }
    if (badge.metadataCid) allCids.add(badge.metadataCid);
  }
  for (const cert of certs) {
    if (cert.imageCid) { certImageCids.add(cert.imageCid); allCids.add(cert.imageCid); }
    if (cert.metadataCid) allCids.add(cert.metadataCid);
  }

  console.log(`\nBadge image CIDs : ${badgeImageCids.size}`);
  console.log(`Cert image CIDs  : ${certImageCids.size}`);
  console.log(`Total CIDs       : ${allCids.size}`);

  let carDownloaded = 0, carFailed = 0, carSkipped = 0;
  let imgExtracted = 0, imgFallback = 0, imgFailed = 0, imgSkipped = 0;

  // ── Step 1: Ensure all CARs are present ──────────────────────────────────
  console.log("\n[1/2] Downloading missing CAR files...");
  for (const cid of allCids) {
    const carPath = path.join(BACKUP_DIR, `${cid}.car`);
    if (fs.existsSync(carPath)) {
      carSkipped++;
      continue;
    }
    process.stdout.write(`  CAR ${cid} ... `);
    const result = await downloadCar(cid);
    if (result.ok) {
      console.log("OK");
      carDownloaded++;
    } else {
      console.log(`FAILED (${result.error})`);
      carFailed++;
    }
  }

  // ── Step 2: Extract images from CARs ─────────────────────────────────────
  console.log("\n[2/2] Extracting images from CAR files...");

  const imageWork: Array<{ cid: string; destDir: string }> = [
    ...[...badgeImageCids].map((cid) => ({ cid, destDir: BADGES_PATH })),
    ...[...certImageCids].map((cid) => ({ cid, destDir: CERTIFICATES_PATH })),
  ];

  for (const { cid, destDir } of imageWork) {
    if (findLocalFile(destDir, cid)) {
      imgSkipped++;
      continue;
    }

    fs.mkdirSync(destDir, { recursive: true });
    process.stdout.write(`  Image ${cid} ... `);

    const carPath = path.join(BACKUP_DIR, `${cid}.car`);
    if (fs.existsSync(carPath)) {
      const imageBytes = await extractImageFromCar(carPath);
      if (imageBytes && imageBytes.length > 0) {
        const ext = detectExt(imageBytes);
        fs.writeFileSync(path.join(destDir, `${cid}.${ext}`), imageBytes);
        console.log(`extracted from CAR (.${ext})`);
        imgExtracted++;
        continue;
      }
      process.stdout.write("CAR extraction failed, trying gateway ... ");
    }

    // Fallback: download raw from gateway
    const result = await downloadRawImage(cid, destDir);
    if (result.ok) {
      console.log("downloaded from gateway");
      imgFallback++;
    } else {
      console.log(`FAILED (${result.error})`);
      imgFailed++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("Summary");
  console.log("=".repeat(50));
  console.log(`CARs   : ${carSkipped} already present, ${carDownloaded} downloaded, ${carFailed} failed`);
  console.log(`Images : ${imgSkipped} already present, ${imgExtracted} extracted from CAR, ${imgFallback} from gateway, ${imgFailed} failed`);

  if (carFailed > 0 || imgFailed > 0) {
    console.log("\nSome files could not be processed. Re-run to retry.");
    process.exit(1);
  }

  console.log("\nAll files verified.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nUnexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
