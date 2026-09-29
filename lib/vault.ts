import { VAULT_HOST, VAULT_TOKEN } from "./const";
import algosdk from "algosdk";
import { cleanString, concatArrays, getHash } from "./utils";

export const getWallet = async (key: string) => {
  try {
    const res = await fetch(`${VAULT_HOST}/v1/transit/keys/${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vault-Token": VAULT_TOKEN,
      },
      body: JSON.stringify({
        type: "ed25519",
        derived: false,
        allow_deletion: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();

    const publicKey: Buffer = Buffer.from(
      data.data.keys["1"].public_key,
      "base64"
    );

    const address = algosdk.encodeAddress(publicKey);

    return address;
  } catch (error) {
    console.error("Error getting wallet:", error);
    return null;
  }
};

const signBytes = async (
  bytes: Uint8Array,
  signer: string
): Promise<Uint8Array> => {
  const res = await fetch(`${VAULT_HOST}/v1/transit/sign/${signer}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Vault-Token": VAULT_TOKEN,
    },
    body: JSON.stringify({
      input: Buffer.from(bytes).toString("base64"),
    }),
  });
  const data = await res.json();
  const rawSignature = data.data.signature.toString();
  const signature = rawSignature.split(":")[2];
  const signatureBuffer = Buffer.from(signature, "base64");
  return new Uint8Array(signatureBuffer);
};

/**
 * Resolves a Vault transit key name. The three platform wallets are keyed by
 * their role name; every other signer is a user whose key is the hash of their
 * cleaned email.
 */
export const vaultKeyName = (signerEmail: string) => {
  const isPlatform =
    signerEmail === "admin" ||
    signerEmail === "operational" ||
    signerEmail === "onboarding";
  return isPlatform ? signerEmail : getHash(cleanString(signerEmail));
};

/**
 * Signs an already-encoded, already-grouped transaction.
 *
 * signTransactions() below assigns its own group ID, which is wrong for
 * transactions built elsewhere (the x402 payment group is composed and grouped
 * by @x402/avm before it reaches us).
 */
export const signEncodedTransaction = async (
  encodedTxn: Uint8Array,
  signerEmail: string,
  signerAddress: string
): Promise<Uint8Array> => {
  const txn = algosdk.decodeUnsignedTransaction(encodedTxn);
  const signature = await signBytes(txn.bytesToSign(), vaultKeyName(signerEmail));
  return txn.attachSignature(signerAddress, signature);
};

export const signTransactions = async (
  transactions: {
    txn: algosdk.Transaction;
    signerEmail: string;
    signerAddress: string;
  }[]
) => {
  const txObjects = transactions.map((transaction) => {
    return transaction.txn;
  });
  const txnGroup = algosdk.assignGroupID(txObjects);
  const signatures: Uint8Array[] = [];
  for (let i = 0; i < txnGroup.length; i++) {
    const bytes = txnGroup[i].bytesToSign();
    const signature = await signBytes(
      bytes,
      vaultKeyName(transactions[i].signerEmail)
    );
    signatures.push(signature);
  }
  const txnGroupWithSignatures = txnGroup.map((txn, index) => {
    return txn.attachSignature(
      transactions[index].signerAddress,
      signatures[index]
    );
  });
  const txnIds = txnGroup.map((txn) => txn.txID());
  const bytes = concatArrays(...txnGroupWithSignatures);
  return { bytes, txnIds };
};
