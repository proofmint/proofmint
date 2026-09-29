import { NextRequest, NextResponse } from "next/server";
import { issuerAccount } from "@/lib/x402/accounts";
import { createPaymentHeaders } from "@/lib/x402/client";
import { getUsdcHolding } from "@/lib/x402/usdc";

export const runtime = "nodejs";

/**
 * Signs an x402 payment on behalf of the logged-in issuer.
 *
 * ProofMint wallets live in Vault, so the browser cannot sign the payment group
 * itself. Instead it forwards the 402 declaration it received here, we build and
 * sign the USDC transfer, and it retries the original request with the returned
 * X-PAYMENT header. The declaration is checked against our own configuration
 * before anything is signed.
 */
export async function POST(req: NextRequest) {
  const account = await issuerAccount(req);
  if ("error" in account) return account.error;
  if (!account.signerEmail) {
    return NextResponse.json(
      { error: "Your wallet is not managed by ProofMint" },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const holding = await getUsdcHolding(account.address);
  if (!holding.optedIn) {
    return NextResponse.json(
      {
        error:
          "Your wallet is not opted into USDC. Opt in from your profile before paying with x402.",
        optedIn: false,
      },
      { status: 400 }
    );
  }

  try {
    const result = await createPaymentHeaders({
      signerAddress: account.address,
      signerEmail: account.signerEmail,
      paymentRequiredHeader: body.paymentRequiredHeader ?? null,
      body: body.body,
    });
    return NextResponse.json({ ...result, balance: holding.balance });
  } catch (e) {
    console.error("[x402] failed to build payment header", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not build the x402 payment",
        balance: holding.balance,
      },
      { status: 400 }
    );
  }
}
