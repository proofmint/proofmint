/**
 * One-time uploads layout migration.
 *
 * Old layout:
 *   uploads/badges/*                        - badge images
 *   uploads/certificates/*                   - certificate images
 *   uploads/certificates/templates/*         - certificate template backgrounds
 *   uploads/ipfs-backup/*.car                - CARs written by the app
 *   uploads/storacha-backup/cars/*.car        - CARs recovered from Storacha
 *   uploads/storacha-backup/images/*         - images + metadata (as .bin)
 *                                               recovered from Storacha after
 *                                               a DB-loss incident
 *
 * New layout:
 *   uploads/images/*      - all badge + certificate images, keyed by CID
 *   uploads/metadata/*    - all metadata JSON, keyed by CID ({cid}.json)
 *   uploads/templates/*   - certificate template backgrounds
 *   uploads/cars/*        - all CAR files, keyed by CID
 *
 * Copy-only — nothing is deleted or moved. Safe to re-run: existing
 * destination files are skipped.
 *
 * USAGE
 * -----
 *   pnpm migrate:uploads
 *
 * OPTIONAL ENV VARS
 * -----------------
 *   UPLOADS_PATH   – Absolute path to the uploads directory (default: ./uploads)
 */

import { config as loadEnv } from "dotenv";
loadEnv();

import fs from "fs";
import path from "path";

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(process.cwd(), "uploads");

const OLD_BADGES = path.join(UPLOADS_PATH, "badges");
const OLD_CERTIFICATES = path.join(UPLOADS_PATH, "certificates");
const OLD_TEMPLATES = path.join(OLD_CERTIFICATES, "templates");
const OLD_IPFS_BACKUP = path.join(UPLOADS_PATH, "ipfs-backup");
const OLD_STORACHA_CARS = path.join(UPLOADS_PATH, "storacha-backup", "cars");
const OLD_STORACHA_IMAGES = path.join(UPLOADS_PATH, "storacha-backup", "images");

const NEW_IMAGES = path.join(UPLOADS_PATH, "images");
const NEW_METADATA = path.join(UPLOADS_PATH, "metadata");
const NEW_TEMPLATES = path.join(UPLOADS_PATH, "templates");
const NEW_CARS = path.join(UPLOADS_PATH, "cars");

interface Counts {
  copied: number;
  skipped: number;
}

function freshCounts(): Counts {
  return { copied: 0, skipped: 0 };
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

function copyIfMissing(src: string, dest: string, counts: Counts): void {
  if (fs.existsSync(dest)) {
    counts.skipped++;
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  counts.copied++;
}

/** Loose check that a parsed JSON object looks like our CertificateMetadata shape. */
function looksLikeCertificateMetadata(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    typeof v.image === "string" &&
    typeof v.image_integrity === "string"
  );
}

function migrateTemplates(): Counts {
  const counts = freshCounts();
  for (const file of listFiles(OLD_TEMPLATES)) {
    copyIfMissing(path.join(OLD_TEMPLATES, file), path.join(NEW_TEMPLATES, file), counts);
  }
  return counts;
}

function migrateCertificateImages(): Counts {
  const counts = freshCounts();
  for (const file of listFiles(OLD_CERTIFICATES)) {
    // listFiles already excludes the templates/ subdirectory (isFile() filters it out)
    copyIfMissing(path.join(OLD_CERTIFICATES, file), path.join(NEW_IMAGES, file), counts);
  }
  return counts;
}

function migrateBadgeImages(): Counts {
  const counts = freshCounts();
  for (const file of listFiles(OLD_BADGES)) {
    copyIfMissing(path.join(OLD_BADGES, file), path.join(NEW_IMAGES, file), counts);
  }
  return counts;
}

function migrateCars(): Counts {
  const counts = freshCounts();
  for (const file of listFiles(OLD_IPFS_BACKUP)) {
    if (!file.endsWith(".car")) continue;
    copyIfMissing(path.join(OLD_IPFS_BACKUP, file), path.join(NEW_CARS, file), counts);
  }
  for (const file of listFiles(OLD_STORACHA_CARS)) {
    if (!file.endsWith(".car")) continue;
    copyIfMissing(path.join(OLD_STORACHA_CARS, file), path.join(NEW_CARS, file), counts);
  }
  return counts;
}

/** Recovers uploads/storacha-backup/images/* — a mix of real images and metadata JSON saved with a .bin extension. */
function migrateStorachaBackupImages(): { images: Counts; metadata: Counts; skippedUnparsable: number } {
  const images = freshCounts();
  const metadata = freshCounts();
  let skippedUnparsable = 0;

  for (const file of listFiles(OLD_STORACHA_IMAGES)) {
    const srcPath = path.join(OLD_STORACHA_IMAGES, file);
    const parsed = path.parse(file);

    if (parsed.ext === ".bin") {
      let json: unknown;
      try {
        json = JSON.parse(fs.readFileSync(srcPath, "utf8"));
      } catch {
        skippedUnparsable++;
        continue;
      }
      if (!looksLikeCertificateMetadata(json)) {
        skippedUnparsable++;
        continue;
      }
      const destPath = path.join(NEW_METADATA, `${parsed.name}.json`);
      if (fs.existsSync(destPath)) {
        metadata.skipped++;
        continue;
      }
      fs.mkdirSync(NEW_METADATA, { recursive: true });
      fs.writeFileSync(destPath, JSON.stringify(json, null, 2));
      metadata.copied++;
      continue;
    }

    copyIfMissing(srcPath, path.join(NEW_IMAGES, file), images);
  }

  return { images, metadata, skippedUnparsable };
}

function main() {
  console.log("=".repeat(60));
  console.log("Uploads layout migration");
  console.log("=".repeat(60));
  console.log(`Uploads root: ${UPLOADS_PATH}\n`);

  for (const dir of [NEW_IMAGES, NEW_METADATA, NEW_TEMPLATES, NEW_CARS]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const templates = migrateTemplates();
  console.log(`Templates          : ${templates.copied} copied, ${templates.skipped} already present`);

  const certImages = migrateCertificateImages();
  console.log(`Certificate images : ${certImages.copied} copied, ${certImages.skipped} already present`);

  const badgeImages = migrateBadgeImages();
  console.log(`Badge images       : ${badgeImages.copied} copied, ${badgeImages.skipped} already present`);

  const cars = migrateCars();
  console.log(`CARs               : ${cars.copied} copied, ${cars.skipped} already present`);

  const storachaBackup = migrateStorachaBackupImages();
  console.log(
    `Storacha-backup images   : ${storachaBackup.images.copied} copied, ${storachaBackup.images.skipped} already present`
  );
  console.log(
    `Storacha-backup metadata : ${storachaBackup.metadata.copied} copied, ${storachaBackup.metadata.skipped} already present, ${storachaBackup.skippedUnparsable} unparsable/skipped`
  );

  console.log("\nDone. Old folders were left untouched.");
}

main();
