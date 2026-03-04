import * as StorachaClient from "@storacha/client";
import { StoreMemory } from "@storacha/client/stores";
import * as Proof from "@storacha/client/proof";
import { Signer} from "@storacha/client/principal/ed25519"


type StorachaClientInstance = Awaited<ReturnType<typeof StorachaClient.create>>;


/**
 * Create and configure a Storacha client using env vars:
 *   STORACHA_PRINCIPAL – base64-encoded Ed25519 private key (from `storacha key create`)
 *   STORACHA_PROOF     – base64-encoded UCAN delegation CAR  (from `storacha delegation create`)
 *
 * The client is non-interactive and suitable for server-side / script use.
 * A Memory store is used so no data is persisted to disk.
 */
export async function createStorachaClient(): Promise<StorachaClientInstance> {
  const principalKey = process.env.STORACHA_PRINCIPAL;
  const proofData = process.env.STORACHA_PROOF;

  if (!principalKey || !proofData) {
    throw new Error(
      "STORACHA_PRINCIPAL and STORACHA_PROOF environment variables are required. " +
        "Generate them with: storacha key create && storacha delegation create"
    );
  }

  const principal = Signer.parse(principalKey);
  const store = new StoreMemory();
  const client = await StorachaClient.create({ principal, store });

  const proof = await Proof.parse(proofData);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  return client;
}

// Lazy singleton – reused across calls within the same process (e.g. Next.js server)
let _client: StorachaClientInstance | null = null;

async function getClient(): Promise<StorachaClientInstance> {
  if (!_client) _client = await createStorachaClient();
  return _client;
}

/**
 * Upload an image File to Storacha.
 * Returns an object with IpfsHash to match the Pinata response shape used
 * throughout the app (IPFSUploadResult).
 */
const uploadImageToStoracha = async (
  file: File
): Promise<{ IpfsHash: string }> => {
  const client = await getClient();
  const cid = await client.uploadFile(file);
  return { IpfsHash: cid.toString() };
};

/**
 * Upload a JSON object to Storacha as metadata.json.
 * Returns an object with IpfsHash to match the Pinata response shape.
 */
const uploadJsonToStoracha = async (
  json: any
): Promise<{ IpfsHash: string }> => {
  const client = await getClient();
  const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
  const file = new File([blob], "metadata.json", { type: "application/json" });
  const cid = await client.uploadFile(file);
  return { IpfsHash: cid.toString() };
};

export { uploadImageToStoracha, uploadJsonToStoracha };
