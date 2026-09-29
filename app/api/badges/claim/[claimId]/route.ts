import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireReceiver } from "@/lib/auth";
import { X402_PRICE_CLAIM } from "@/lib/x402/config";
import {
  BadgeClaimError,
  executeMagicLinkBadgeClaim,
} from "@/lib/services/badgeClaim";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params;

  try {
    const claim = await prisma.badgeClaimLink.findFirst({
      where: {
        id: claimId,
      },
      include: {
        badge: true,
        issuedBadges: true,
        issuer: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const receiverEmails = claim.issuedBadges.map(
      (instance) => instance.receiverEmail
    );

    const receiverUsers = await prisma.user.findMany({
      where: {
        email: { in: receiverEmails },
      },
    });

    return NextResponse.json({
      ...claim,
      receiverUsers,
      x402Price: X402_PRICE_CLAIM,
    });
  } catch (error) {
    console.error(`Failed to fetch claim ${claimId}:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params;

  const auth = await requireReceiver(req);
  if ("error" in auth) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.payload.userId },
    select: { walletAddress: true, email: true },
  });

  if (!user?.walletAddress) {
    return NextResponse.json(
      { error: "Your account has no wallet address yet" },
      { status: 400 }
    );
  }

  try {
    const { txnId } = await executeMagicLinkBadgeClaim({
      claimId,
      receiverEmail: user.email,
      walletAddress: user.walletAddress,
    });
    return NextResponse.json({ txnId });
  } catch (error) {
    if (error instanceof BadgeClaimError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to process badge action:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
