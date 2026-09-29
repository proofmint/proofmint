import { NextRequest, NextResponse } from "next/server";
import { X402ProductKind } from "@prisma/client";
import { withX402FromHTTPServer } from "@x402/next";
import { httpServerForRoute } from "@/lib/x402/server";
import { badgeClaimRoute } from "@/lib/x402/routes";
import {
  corsOptions,
  mintMetaHeaders,
  withSettlementRecording,
} from "@/lib/x402/withSettlement";
import { receiverAccount } from "@/lib/x402/accounts";
import {
  BadgeClaimError,
  executeMagicLinkBadgeClaim,
} from "@/lib/services/badgeClaim";

export const runtime = "nodejs";

function claimIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/api\/x402\/badges\/claim\/([^/]+)$/);
  return match?.[1] ?? null;
}

/**
 * Every failure path returns 4xx/5xx on purpose: withX402 settles the USDC
 * payment only when this handler resolves with a status below 400, so a
 * receiver is never charged for a badge that was not claimed.
 */
const handler = async (req: NextRequest) => {
  const claimId = claimIdFromPath(req.nextUrl.pathname);
  if (!claimId) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  const account = await receiverAccount(req);
  if ("error" in account) return account.error;
  if (!account.signerEmail) {
    return NextResponse.json(
      { error: "Your wallet is not managed by ProofMint" },
      { status: 400 }
    );
  }

  try {
    const result = await executeMagicLinkBadgeClaim({
      claimId,
      receiverEmail: account.signerEmail,
      walletAddress: account.address,
    });
    return NextResponse.json(
      { txnId: result.txnId },
      {
        status: 200,
        headers: mintMetaHeaders({
          issuerId: result.issuerId,
          quantity: 1,
          refId: claimId,
        }),
      }
    );
  } catch (error) {
    if (error instanceof BadgeClaimError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[x402] badge claim failed", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
};

export const POST = withSettlementRecording(
  withX402FromHTTPServer(
    handler,
    httpServerForRoute("POST /api/x402/badges/claim/:claimId", badgeClaimRoute)
  ),
  X402ProductKind.BADGE_CLAIM
);

export const OPTIONS = async () => corsOptions();
