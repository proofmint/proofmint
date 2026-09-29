import type { ClientAvmSigner } from "@x402/avm";
import { signEncodedTransaction } from "@/lib/vault";

/**
 * A ClientAvmSigner backed by HashiCorp Vault transit keys.
 *
 * ProofMint wallets are custodial: the private key never leaves Vault, so the
 * x402 payment group is composed by @x402/avm and then handed here one
 * transaction at a time to be signed remotely.
 */
export function vaultClientAvmSigner(params: {
  address: string;
  /** Vault key selector: a user email, or "admin"/"operational"/"onboarding". */
  signerEmail: string;
}): ClientAvmSigner {
  return {
    address: params.address,
    async signTransactions(txns, indexesToSign) {
      const targets = new Set(indexesToSign ?? txns.map((_, i) => i));
      // The returned array must stay aligned with the full group: the scheme
      // reads signedTxns[i] and falls back to the unsigned bytes on null.
      const signed: (Uint8Array | null)[] = [];
      for (let i = 0; i < txns.length; i++) {
        signed.push(
          targets.has(i)
            ? await signEncodedTransaction(
                txns[i],
                params.signerEmail,
                params.address
              )
            : null
        );
      }
      return signed;
    },
  };
}
