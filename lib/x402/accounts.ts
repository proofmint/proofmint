import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireIssuer, requireReceiver } from "@/lib/auth";
import { getPayTo } from "./config";
import { platformSignerFor } from "./usdc";
import type { UsdcAccount } from "./usdcRoutes";

/**
 * The address x402 revenue settles to. Only signable here when it is one of the
 * three platform wallets ProofMint holds Vault keys for; an external treasury
 * address is shown read-only.
 */
export function payToAccount(): UsdcAccount | { error: NextResponse } {
  let address: string;
  try {
    address = getPayTo();
  } catch (e) {
    return {
      error: NextResponse.json(
        {
          error: e instanceof Error ? e.message : "X402_PAY_TO is not configured",
          configured: false,
        },
        { status: 503 }
      ),
    };
  }
  return {
    address,
    signerEmail: platformSignerFor(address),
    label: "x402 revenue wallet",
  };
}

/** The calling issuer's custodial wallet, which is what pays for x402 mints. */
export async function issuerAccount(
  req: NextRequest
): Promise<UsdcAccount | { error: NextResponse }> {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.payload.userId },
    select: { walletAddress: true, email: true },
  });

  if (!user?.walletAddress) {
    return {
      error: NextResponse.json(
        { error: "Your account has no wallet address yet" },
        { status: 400 }
      ),
    };
  }

  return {
    address: user.walletAddress,
    signerEmail: user.email,
    label: "Your issuer wallet",
  };
}

/** The calling receiver's custodial wallet, which pays for x402 badge claims. */
export async function receiverAccount(
  req: NextRequest
): Promise<UsdcAccount | { error: NextResponse }> {
  const auth = await requireReceiver(req);
  if ("error" in auth) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.payload.userId },
    select: { walletAddress: true, email: true },
  });

  if (!user?.walletAddress) {
    return {
      error: NextResponse.json(
        { error: "Your account has no wallet address yet" },
        { status: 400 }
      ),
    };
  }

  return {
    address: user.walletAddress,
    signerEmail: user.email,
    label: "Your receiver wallet",
  };
}
