import { NextResponse } from "next/server";
import {
  getUsdcHolding,
  optInToUsdc,
  toUsdcAtomic,
  txExplorerUrl,
  withdrawUsdc,
} from "./usdc";
import {
  X402_PRICE_BADGE,
  X402_PRICE_CERTIFICATE,
  X402_PRICE_CLAIM,
} from "./config";

/** The wallet an x402 USDC panel manages, plus the Vault key that signs for it. */
export interface UsdcAccount {
  address: string;
  /** Null when the address is not one ProofMint holds a key for. */
  signerEmail: string | null;
  label: string;
}

export async function usdcStatusResponse(account: UsdcAccount) {
  const holding = await getUsdcHolding(account.address);
  return NextResponse.json({
    ...holding,
    label: account.label,
    managed: account.signerEmail !== null,
    prices: {
      badge: X402_PRICE_BADGE,
      certificate: X402_PRICE_CERTIFICATE,
      claim: X402_PRICE_CLAIM,
    },
  });
}

export async function usdcOptInResponse(account: UsdcAccount) {
  if (!account.signerEmail) {
    return NextResponse.json(
      { error: `${account.label} is not held by ProofMint, so it cannot be opted in here` },
      { status: 400 }
    );
  }
  try {
    const result = await optInToUsdc({
      address: account.address,
      signerEmail: account.signerEmail,
    });
    return NextResponse.json({
      ...result,
      explorerUrl: result.txId ? txExplorerUrl(result.txId) : null,
      message: result.alreadyOptedIn
        ? "Already opted into USDC"
        : "Opted into USDC",
    });
  } catch (e) {
    console.error("[x402] USDC opt-in failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "USDC opt-in failed" },
      { status: 400 }
    );
  }
}

export async function usdcWithdrawResponse(
  account: UsdcAccount,
  body: { to?: unknown; amount?: unknown }
) {
  if (!account.signerEmail) {
    return NextResponse.json(
      { error: `${account.label} is not held by ProofMint, so it cannot be withdrawn from here` },
      { status: 400 }
    );
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const amount = Number(body.amount);
  if (!to) {
    return NextResponse.json({ error: "Destination address is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  try {
    const { txId } = await withdrawUsdc({
      from: account.address,
      signerEmail: account.signerEmail,
      to,
      amountAtomic: toUsdcAtomic(amount),
    });
    return NextResponse.json({
      txId,
      explorerUrl: txExplorerUrl(txId),
      message: `Sent ${amount.toFixed(6)} USDC`,
    });
  } catch (e) {
    console.error("[x402] USDC withdrawal failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "USDC withdrawal failed" },
      { status: 400 }
    );
  }
}
