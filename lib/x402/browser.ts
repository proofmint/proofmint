/**
 * Browser half of the x402 flow for custodial wallets.
 *
 * ProofMint wallets live in Vault, so the browser cannot sign the USDC payment
 * itself. It makes the unpaid request, hands the 402 declaration to a pay
 * endpoint for signing, then retries with the returned X-PAYMENT header. The
 * server settles only when the inner handler succeeds.
 *
 * Issuers default to /api/issuer/x402/pay; receivers pass
 * { payEndpoint: "/api/receiver/x402/pay" }.
 */

export interface X402Result {
  status: number;
  ok: boolean;
  data: any;
  /** True when the request was retried with a signed payment. */
  paid: boolean;
  /** Settlement receipt header, present when the facilitator settled. */
  settlement: string | null;
}

const DEFAULT_PAY_ENDPOINT = "/api/issuer/x402/pay";

async function readJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function x402Post(
  url: string,
  body: unknown,
  options?: { payEndpoint?: string }
): Promise<X402Result> {
  const payEndpoint = options?.payEndpoint ?? DEFAULT_PAY_ENDPOINT;
  const request = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const unpaid = await request();
  if (unpaid.status !== 402) {
    return {
      status: unpaid.status,
      ok: unpaid.ok,
      data: await readJson(unpaid),
      paid: false,
      settlement: null,
    };
  }

  // x402 v2 puts the declaration in the PAYMENT-REQUIRED header, not the body.
  const paymentRequiredHeader = unpaid.headers.get("PAYMENT-REQUIRED");
  const declaration = await readJson(unpaid);

  if (!paymentRequiredHeader) {
    // A 402 without a declaration is one of our own guards, e.g. no credits.
    return {
      status: unpaid.status,
      ok: false,
      data: declaration,
      paid: false,
      settlement: null,
    };
  }

  const payRes = await fetch(payEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentRequiredHeader, body: declaration }),
  });
  const pay = await readJson(payRes);
  if (!payRes.ok) {
    throw new Error(pay?.error || "Could not authorise the USDC payment");
  }

  const paid = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(pay.headers ?? {}) },
    body: JSON.stringify(body),
  });

  return {
    status: paid.status,
    ok: paid.ok,
    data: await readJson(paid),
    paid: true,
    settlement:
      paid.headers.get("PAYMENT-RESPONSE") ??
      paid.headers.get("X-PAYMENT-RESPONSE"),
  };
}

/** Reads a File as a data URL, which is what the x402 badge endpoint accepts. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file"));
    reader.readAsDataURL(file);
  });
}

/** Converts the dashboard's {key,value} rows into an ARC-3 properties object. */
export function propertiesObject(
  rows: { key: string; value: string }[]
): Record<string, string> {
  return Object.fromEntries(rows.map((p) => [p.key, p.value]));
}
