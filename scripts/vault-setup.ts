/**
 * Vault bootstrap: init (or unseal) + mount the transit secrets engine.
 *
 * Adapted from the same pattern used in the `hashi` project (single-key
 * Shamir split — secret_shares: 1, secret_threshold: 1 — simple on purpose,
 * this is a self-hosted single-node Vault, not a multi-operator cluster).
 *
 * First run against a fresh Vault: initializes it, writes the root token +
 * unseal key to vault-seal-keys.json (repo root, gitignored — back this
 * file up, it cannot be regenerated), unseals, and mounts `transit`
 * (lib/vault.ts uses the transit engine's sign/keys endpoints).
 *
 * Every subsequent run (e.g. after `docker compose restart vault`, since
 * Vault re-seals on every process start): reads the saved seal key and just
 * unseals — safe to re-run any time.
 *
 * USAGE
 * -----
 *   pnpm vault:setup
 *
 * REQUIRED ENV VARS
 * -----------------
 *   VAULT_HOST   – Vault base URL (e.g. http://127.0.0.1:8200 or http://vault:8200)
 */

import { config as loadEnv } from "dotenv";
loadEnv();

import fs from "fs";
import path from "path";

const VAULT_HOST = (process.env.VAULT_HOST || "http://127.0.0.1:8200").replace(/\/+$/, "");
const SEAL_KEYS_PATH = path.join(process.cwd(), "vault-seal-keys.json");

interface InitResult {
  keys: string[];
  root_token: string;
  [key: string]: unknown;
}

async function isInitialized(): Promise<boolean> {
  const res = await fetch(`${VAULT_HOST}/v1/sys/init`);
  if (!res.ok) throw new Error(`GET /v1/sys/init failed: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  return !!data.initialized;
}

async function initVault(): Promise<InitResult> {
  const res = await fetch(`${VAULT_HOST}/v1/sys/init`, {
    method: "POST",
    body: JSON.stringify({ secret_shares: 1, secret_threshold: 1 }),
  });
  if (!res.ok) throw new Error(`POST /v1/sys/init failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function unseal(key: string): Promise<void> {
  const res = await fetch(`${VAULT_HOST}/v1/sys/unseal`, {
    method: "POST",
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error(`POST /v1/sys/unseal failed: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.sealed) throw new Error("Vault reported sealed=true after unseal — wrong key?");
}

async function mountTransitIfMissing(rootToken: string): Promise<void> {
  const res = await fetch(`${VAULT_HOST}/v1/sys/mounts`, {
    headers: { "X-Vault-Token": rootToken },
  });
  if (!res.ok) throw new Error(`GET /v1/sys/mounts failed: HTTP ${res.status} ${await res.text()}`);
  const mounts = await res.json();

  if (mounts["transit/"]) {
    console.log("transit secrets engine already mounted.");
    return;
  }

  const mountRes = await fetch(`${VAULT_HOST}/v1/sys/mounts/transit`, {
    method: "POST",
    headers: { "X-Vault-Token": rootToken, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "transit", config: { force_no_cache: true } }),
  });
  if (!mountRes.ok) {
    throw new Error(`POST /v1/sys/mounts/transit failed: HTTP ${mountRes.status} ${await mountRes.text()}`);
  }
  console.log("transit secrets engine mounted.");
}

async function main() {
  console.log("=".repeat(60));
  console.log("Vault setup");
  console.log("=".repeat(60));
  console.log(`Target: ${VAULT_HOST}\n`);

  const alreadyInitialized = await isInitialized();

  let rootToken: string;
  let firstKey: string;

  if (!alreadyInitialized) {
    console.log("Not yet initialized — initializing (single key, threshold 1)...");
    const initResult = await initVault();
    fs.writeFileSync(SEAL_KEYS_PATH, JSON.stringify(initResult, null, 2));
    console.log(`Seal keys written to: ${SEAL_KEYS_PATH}`);
    console.log("Back this file up — it cannot be regenerated if lost.");
    rootToken = initResult.root_token;
    firstKey = initResult.keys[0];
  } else {
    console.log("Already initialized — reading saved seal keys...");
    if (!fs.existsSync(SEAL_KEYS_PATH)) {
      throw new Error(
        `Vault reports it's already initialized but ${SEAL_KEYS_PATH} is missing, so it can't be unsealed.\n` +
        "If you restored from a backup, make sure vault-seal-keys.json was restored alongside the vault data directory."
      );
    }
    const saved: InitResult = JSON.parse(fs.readFileSync(SEAL_KEYS_PATH, "utf8"));
    rootToken = saved.root_token;
    firstKey = saved.keys[0];
  }

  console.log("\nUnsealing...");
  await unseal(firstKey);
  console.log("Vault is unsealed.");

  console.log("\nEnsuring transit secrets engine is mounted...");
  await mountTransitIfMissing(rootToken);

  console.log("\nDone.");
  console.log(`Root token: ${rootToken}`);
  console.log("Make sure VAULT_TOKEN in your .env matches this value.");
}

main().catch((err) => {
  console.error("\nVault setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
