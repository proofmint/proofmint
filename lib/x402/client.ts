import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { Network } from "@x402/core/types";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import {
  ALGOD_BASE_URL,
  USDC_ASA_ID,
  X402_NETWORK,
  X402_NETWORK_CANONICAL,
  X402_NETWORK_FULL,
  getPayTo,
  X402_MAX_PAYMENT,
} from "./config";
import { ALGOD_TOKEN } from "@/lib/const";
import { vaultClientAvmSigner } from "./vaultSigner";

/**
 * Builds an x402 client that pays from a Vault-custodied wallet.
 *
 * Spend controls have to be set explicitly: the SDK caps a single payment at $1
 * by default, which would reject even a single $2 mint.
 */
function clientFor(signerAddress: string, signerEmail: string): x402HTTPClient {
  const scheme = new ExactAvmScheme(
    vaultClientAvmSigner({ address: signerAddress, signerEmail }),
    { algodUrl: ALGOD_BASE_URL, algodToken: ALGOD_TOKEN }
  );

  const client = new x402Client();
  for (const network of new Set([
    X402_NETWORK,
    X402_NETWORK_FULL,
    X402_NETWORK_CANONICAL,
  ])) {
    client.register(network as Network, scheme);
  }
  client.setSpendControls({ maxAmountPerPayment: X402_MAX_PAYMENT });

  return new x402HTTPClient(client);
}

/**
 * Rejects a payment declaration that is not one of ours.
 *
 * The declaration reaches us from the browser, so without this an issuer's
 * custodial wallet could be asked to sign a transfer to an arbitrary address.
 * It is the issuer's own money either way, but the endpoint should only ever be
 * able to pay ProofMint.
 */
function assertOurDeclaration(paymentRequired: any) {
  const accepts = paymentRequired?.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw new Error("Payment declaration has no accepts entries");
  }

  const payTo = getPayTo();
  const allowedNetworks = new Set([
    String(X402_NETWORK),
    X402_NETWORK_FULL,
    X402_NETWORK_CANONICAL,
  ]);

  for (const option of accepts) {
    if (option.payTo !== payTo) {
      throw new Error("Payment declaration does not pay ProofMint");
    }
    if (!allowedNetworks.has(String(option.network))) {
      throw new Error(`Unexpected settlement network: ${option.network}`);
    }
    const asset = String(option.asset ?? option.extra?.asset ?? "");
    if (asset && asset !== USDC_ASA_ID) {
      throw new Error(`Unexpected settlement asset: ${asset}`);
    }
  }
}

/**
 * Turns a 402 declaration into the request headers that pay it.
 *
 * The browser cannot sign for a custodial wallet, so it hands the declaration
 * back here, we build and sign the payment group, and it retries the original
 * request with the returned headers.
 */
export async function createPaymentHeaders(params: {
  signerAddress: string;
  signerEmail: string;
  /** Base64 PAYMENT-REQUIRED response header (x402 v2 puts it there, not in the body). */
  paymentRequiredHeader?: string | null;
  /** 402 response body, used for the v1 fallback. */
  body?: unknown;
}): Promise<{ headers: Record<string, string>; accepted: unknown }> {
  const http = clientFor(params.signerAddress, params.signerEmail);

  const paymentRequired = http.getPaymentRequiredResponse(
    (name) =>
      name.toLowerCase() === "payment-required"
        ? params.paymentRequiredHeader ?? null
        : null,
    params.body
  );

  assertOurDeclaration(paymentRequired);

  const payload = await http.createPaymentPayload(paymentRequired);
  return {
    headers: http.encodePaymentSignatureHeader(payload),
    accepted: (payload as any).accepted ?? null,
  };
}
