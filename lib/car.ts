import { importer } from 'ipfs-unixfs-importer';
import { fixedSize } from 'ipfs-unixfs-importer/chunker';
import { MemoryBlockstore } from 'blockstore-core';
import { CarWriter } from '@ipld/car';
import { CID } from 'multiformats';
import fs from 'fs/promises';
import path from 'path';
import { IPFS_BACKUP_PATH } from './uploads';
import prisma from './prisma';

/**
 * Store raw bytes as a local CAR file and upsert an IpfsPinRecord in the DB.
 *
 * Encoding matches `ipfs add --cid-version=1 --raw-leaves`:
 *   - CID version 1, sha2-256
 *   - dag-pb codec for internal/root nodes
 *   - raw-leaves: leaf blocks use raw codec
 *   - fixed chunker, 262144 byte (256 KiB) chunks
 *
 * Deterministic: same content → same CID → same CAR structure.
 *
 * @param bytes - Raw file bytes (image, serialised JSON, etc.)
 * @returns CIDv1 string of the UnixFS root
 */
export async function storeAsCAR(bytes: Uint8Array): Promise<string> {
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
  const carPath = path.join(IPFS_BACKUP_PATH, `${cidStr}.car`);

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
