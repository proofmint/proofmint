import { NextRequest, NextResponse } from "next/server";
import { receiverAccount } from "@/lib/x402/accounts";
import { createPaymentHeaders } from "@/lib/x402/client";
import { getUsdcHolding, priceToAtomic, toUsdcDisplay } from "@/lib/x402/usdc";
import { X402_PRICE_CLAIM } from "@/lib/x402/config";

export const runtime = "nodejs";

/**
 * Signs an x402 payment on behalf of the logged-in receiver.
 *
 * Receiver wallets live in Vault, so the browser cannot sign the payment group
 * itself. The receiver pays with USDC already in their own wallet. This route
 * does not opt the wallet in and does not send USDC from any platform wallet.
 */
export async function POST(req: NextRequest) {
  const account = await receiverAccount(req);
  if ("error" in account) return account.error;
  if (!account.signerEmail) {
    return NextResponse.json(
      { error: "Your wallet is not managed by ProofMint" },
      { status: 400 }
    );
  }

  let body: { paymentRequiredHeader?: string | null; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const holding = await getUsdcHolding(account.address);
  const required = priceToAtomic(X402_PRICE_CLAIM);

  if (!holding.optedIn) {
    return NextResponse.json(
      {
        error:
          "Your wallet is not opted into USDC. Opt in and add USDC before claiming this badge.",
        optedIn: false,
        balance: holding.balance,
      },
      { status: 400 }
    );
  }

  if (BigInt(holding.balanceAtomic) < required) {
    return NextResponse.json(
      {
        error: `Your wallet needs at least ${toUsdcDisplay(required)} USDC to claim this badge. Balance is ${holding.balance}.`,
        optedIn: true,
        balance: holding.balance,
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
    console.error("[x402] failed to build receiver payment header", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not build the x402 payment",
        balance: holding.balance,
      },
      { status: 400 }
    );
  }
}
