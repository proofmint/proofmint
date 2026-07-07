/**
 * Regenerate a CAR file from data you already have, without fetching it
 * from anywhere.
 *
 * PROBLEM
 * -------
 * Some legacy CIDs in the database were originally produced by Storacha's
 * `client.uploadFile()`, which encodes bytes as a UnixFS DAG using fixed,
 * deterministic settings (see @storacha/upload-client's unixfs.js):
 *
 *   fileChunkEncoder: raw, smallFileEncoder: raw,
 *   chunker: withMaxChunkSize(1MB), fileLayout: withWidth(1024)
 *
 * There is no randomness in this encoding — identical input bytes always
 * produce identical blocks and the same root CID. So if you still have the
 * exact bytes that were uploaded (a metadata JSON object, or a raw file) and
 * the CID it produced, you can re-run the same encoding locally, confirm the
 * root CID matches, and get back the exact CAR file that would have been
 * produced originally — without needing any external gateway or API.
 *
 * OUTPUT
 * ------
 * Writes {cid}.car into UPLOADS_PATH/cars/, the same directory
 * scripts/pin-to-ipfs.ts scans for CARs to pin to the local IPFS node.
 *
 * USAGE
 * -----
 *   tsx --tsconfig tsconfig.scripts.json scripts/regenerate-metadata-car.ts \
 *     --cid <expectedCid> --json path/to/metadata.json [--raw]
 *
 *   --cid    Expected CID (v0 or v1) to verify the regenerated data against.
 *   --json   Path to a file containing the metadata.
 *              Default: file is JSON.parse'd then re-serialized with
 *              JSON.stringify(...), matching the original upload exactly.
 *   --raw    Skip the JSON.parse/stringify round-trip and hash the file's
 *              bytes as-is. Use this for non-JSON files (e.g. images) or
 *              when the file on disk is already the exact byte-for-byte
 *              string that was uploaded.
 *
 * REQUIRED ENV VARS
 * -----------------
 *   DATABASE_URL       – MySQL connection string (to record the pin record)
 */

import { config as loadEnv } from "dotenv";
loadEnv();

import fs from "fs";
import path from "path";
import * as UnixFS from "@ipld/unixfs";
import * as raw from "multiformats/codecs/raw";
import { withMaxChunkSize } from "@ipld/unixfs/file/chunker/fixed";
import { withWidth } from "@ipld/unixfs/file/layout/balanced";
import { CarWriter } from "@ipld/car";
import { CID } from "multiformats/cid";
import prisma from "@/lib/prisma";

// Must match @storacha/upload-client's unixfs.js exactly, or the
// regenerated root CID will not match the original.
const settings = UnixFS.configure({
  fileChunkEncoder: raw,
  smallFileEncoder: raw,
  chunker: withMaxChunkSize(1024 * 1024),
  fileLayout: withWidth(1024),
});

// ─── Args ────────────────────────────────────────────────────────────────────

function getArg(name: string): string | undefined {
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

const EXPECTED_CID = getArg("cid");
const JSON_PATH = getArg("json");
const RAW_BYTES = process.argv.includes("--raw");

if (!EXPECTED_CID || !JSON_PATH) {
  console.error(
    "Usage: tsx --tsconfig tsconfig.scripts.json scripts/regenerate-metadata-car.ts --cid <cid> --json <path> [--raw]"
  );
  process.exit(1);
}

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(process.cwd(), "uploads");
const CARS_DIR = path.join(UPLOADS_PATH, "cars");

function normalizeCid(cidStr: string): string {
  return CID.parse(cidStr).toV1().toString();
}

// ─── UnixFS single-file encode (mirrors createFileEncoderStream) ───────────

async function encodeFileBytes(
  bytes: Uint8Array
): Promise<{ rootCid: CID; blocks: { cid: CID; bytes: Uint8Array }[] }> {
  const { readable, writable } = new TransformStream(
    {},
    UnixFS.withCapacity()
  );
  const unixfsWriter = UnixFS.createWriter({ writable, settings });
  const fileWriter = UnixFS.createFileWriter(unixfsWriter);

  const blocks: { cid: CID; bytes: Uint8Array }[] = [];
  const collectDone = readable.pipeTo(
    new WritableStream({
      write(block) {
        blocks.push(block as { cid: CID; bytes: Uint8Array });
      },
    })
  );

  await fileWriter.write(bytes);
  await fileWriter.close();
  await unixfsWriter.close();
  await collectDone;

  const rootBlock = blocks.at(-1);
  if (!rootBlock) throw new Error("UnixFS encoding produced no blocks");
  return { rootCid: rootBlock.cid, blocks };
}

async function writeCar(
  destPath: string,
  rootCid: CID,
  blocks: { cid: CID; bytes: Uint8Array }[]
): Promise<void> {
  const { writer, out } = CarWriter.create([rootCid]);
  const chunks: Uint8Array[] = [];
  const collectDone = (async () => {
    for await (const chunk of out) chunks.push(chunk);
  })();

  for (const block of blocks) await writer.put(block);
  await writer.close();
  await collectDone;

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, Buffer.concat(chunks));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("Regenerate CAR from local data");
  console.log("=".repeat(60));

  const filePath = path.resolve(JSON_PATH!);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let bytes: Uint8Array;
  if (RAW_BYTES) {
    bytes = new Uint8Array(fs.readFileSync(filePath));
    console.log(`Mode        : raw bytes (${bytes.length} bytes)`);
  } else {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(fileContents);
    const restringified = JSON.stringify(parsed);
    bytes = new TextEncoder().encode(restringified);
    console.log(
      `Mode        : JSON re-serialized via JSON.stringify() (${bytes.length} bytes)`
    );
    if (restringified !== fileContents.trim()) {
      console.log(
        "  Note: re-serialized JSON differs byte-for-byte from the file on disk\n" +
          "  (different key order/whitespace). If the CID check below fails,\n" +
          "  retry with --raw so the file's exact bytes are hashed instead."
      );
    }
  }

  console.log("Encoding via UnixFS (matching @storacha/upload-client settings)...");
  const { rootCid, blocks } = await encodeFileBytes(bytes);

  const expected = normalizeCid(EXPECTED_CID!);
  const actual = normalizeCid(rootCid.toString());

  console.log(`Expected CID: ${expected}`);
  console.log(`Actual CID  : ${actual}`);

  if (expected !== actual) {
    console.error(
      "\nMISMATCH — the regenerated data does not hash to the expected CID.\n" +
        "The bytes you provided are not exactly what was originally uploaded."
    );
    process.exit(1);
  }

  console.log("\nMatch confirmed — this is byte-for-byte the original upload.\n");

  const carPath = path.join(CARS_DIR, `${actual}.car`);
  if (fs.existsSync(carPath)) {
    console.log(`CAR already present at: ${carPath}`);
  } else {
    await writeCar(carPath, rootCid, blocks);
    console.log(`CAR written to: ${carPath}`);
  }

  try {
    await prisma.ipfsPinRecord.upsert({
      where: { cid: actual },
      create: { cid: actual },
      update: {},
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  (skipped IpfsPinRecord upsert — ${msg})`);
  }

  console.log(
    "\nNext steps:\n" +
      "  - Run `pnpm pin:ipfs` to pin this CAR to the local IPFS node.\n"
  );

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nUnexpected error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
