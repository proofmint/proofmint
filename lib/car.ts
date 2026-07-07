import { importer } from 'ipfs-unixfs-importer';
import { fixedSize } from 'ipfs-unixfs-importer/chunker';
import { MemoryBlockstore } from 'blockstore-core';
import { CarWriter } from '@ipld/car';
import { CID } from 'multiformats';
import fs from 'fs/promises';
import path from 'path';
import { CARS_PATH, IMAGES_PATH, METADATA_PATH } from './uploads';
import prisma from './prisma';

/**
 * Encode raw bytes into a local CAR file (skipping the write if the CID
 * already exists on disk — same content always hashes to the same CID) and
 * upsert an IpfsPinRecord in the DB.
 *
 * Encoding matches `ipfs add --cid-version=1 --raw-leaves`:
 *   - CID version 1, sha2-256
 *   - dag-pb codec for internal/root nodes
 *   - raw-leaves: leaf blocks use raw codec
 *   - fixed chunker, 262144 byte (256 KiB) chunks
 *
 * @param bytes - Raw file bytes (image, serialised JSON, etc.)
 * @returns CIDv1 string of the UnixFS root
 */
async function encodeAndWriteCAR(bytes: Uint8Array): Promise<string> {
  const blockstore = new MemoryBlockstore();

  let rootCid: CID | undefined;
  for await (const entry of importer(
    [{ path: '', content: bytes }],
    blockstore,
    {
      cidVersion: 1,
      rawLeaves: true,
      chunker: fixedSize({ chunkSize: 262144 }),
    },
  )) {
    rootCid = entry.cid;
  }

  if (!rootCid) throw new Error('ipfs-unixfs-importer produced no entries');

  const cidStr = rootCid.toString();
  const carPath = path.join(CARS_PATH, `${cidStr}.car`);

  // Skip writing if the CAR already exists — same content → same CID
  let carExists = false;
  try {
    await fs.access(carPath);
    carExists = true;
  } catch {
    // file doesn't exist yet
  }

  if (!carExists) {
    const { writer, out } = await CarWriter.create([rootCid]);

    // Collect output bytes concurrently while writing blocks into the writer
    const collectPromise = (async () => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of out) chunks.push(chunk);
      return chunks;
    })();

    // Write all blocks in insertion order (deterministic for identical content).
    // pair.bytes is an AwaitGenerator<Uint8Array> — collect all chunks per block.
    for await (const pair of blockstore.getAll()) {
      const blockChunks: Uint8Array[] = [];
      for await (const chunk of pair.bytes) {
        blockChunks.push(chunk as Uint8Array);
      }
      const blockBytes =
        blockChunks.length === 1
          ? blockChunks[0]
          : new Uint8Array(Buffer.concat(blockChunks));
      await writer.put({ cid: pair.cid, bytes: blockBytes });
    }
    await writer.close();

    const chunks = await collectPromise;
    await fs.writeFile(carPath, Buffer.concat(chunks.map((c) => Buffer.from(c))));
  }

  // Upsert pin record — idempotent; IpfsPin rows track per-provider status
  await prisma.ipfsPinRecord.upsert({
    where: { cid: cidStr },
    update: {},
    create: { cid: cidStr },
  });

  return cidStr;
}

/**
 * Store raw bytes (e.g. an image) as a local CAR file and upsert an
 * IpfsPinRecord in the DB.
 *
 * @param bytes - Raw file bytes
 * @returns CIDv1 string of the UnixFS root
 */
export async function storeAsCAR(bytes: Uint8Array): Promise<string> {
  return encodeAndWriteCAR(bytes);
}

/**
 * Store a metadata object as a local CAR file (same encoding as storeAsCAR)
 * and additionally write it out as a plain, readable JSON file under
 * uploads/metadata — unlike storeAsCAR, the content isn't only reachable by
 * decoding the CAR.
 *
 * @param metadata - Certificate/badge metadata object
 * @returns CIDv1 string of the UnixFS root
 */
export async function storeMetadataAsCAR(metadata: object): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(metadata));
  const cid = await encodeAndWriteCAR(bytes);

  const metadataPath = path.join(METADATA_PATH, `${cid}.json`);
  try {
    await fs.access(metadataPath);
  } catch {
    // Write the exact bytes that were CAR-encoded — not a re-serialized/pretty
    // copy — so the loose file is byte-identical to what's inside the CAR.
    await fs.writeFile(metadataPath, bytes);
  }

  return cid;
}

/**
 * Save a local copy of an uploaded image under uploads/images, keyed by its
 * CID (the same CID the image was stored as a CAR under).
 *
 * @param cid - CIDv1 string returned by storeAsCAR for this image's bytes
 * @param buffer - Image bytes
 * @param ext - File extension (without the leading dot), e.g. "png"
 */
export async function saveImageFile(cid: string, buffer: Buffer, ext: string): Promise<void> {
  await fs.writeFile(path.join(IMAGES_PATH, `${cid}.${ext}`), buffer);
}
