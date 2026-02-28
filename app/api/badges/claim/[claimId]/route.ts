import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { algodClient, JWT_SECRET, OPERATIONAL_WALLET, PINATA_GATEWAY } from "@/lib/const";
import { jwtVerify } from "jose";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import { ensureOnboardingFund } from "@/lib/blockchain";

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

    return NextResponse.json({ ...claim, badge: { ...claim.badge, imageUrl: `${PINATA_GATEWAY}${claim.badge.imageCid}` }, receiverUsers });
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

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;
    const userEmail = (payload as any).email as string;

    // Check if the user is a receiver
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, walletAddress: true, email: true },
    });

    if (!user || user.role !== "RECEIVER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const claim = await prisma.badgeClaimLink.findFirst({
      where: {
        id: claimId,
      },
      include: {
        badge: {
          select: {
            assetId: true,
            id: true,
          },
        },
        issuer: {
          include: {
            user: {
              select: {
                email: true,
                walletAddress: true,
              },
            },
          },
        },
        issuedBadges: {
          select: {
            receiverEmail: true,
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (claim.claimCount >= claim.limit) {
      return NextResponse.json(
        { error: "Claim limit reached" },
        { status: 400 }
      );
    }

    if (claim.issuedBadges.some((u) => u.receiverEmail === user.email)) {
      return NextResponse.json(
        { error: "Badge already claimed" },
        { status: 400 }
      );
    }

    const group = [];
    const onboardingFund = await ensureOnboardingFund(user.walletAddress);
    if (onboardingFund) {
      group.push(onboardingFund);
    }
    const suggestedParams = await algodClient.getTransactionParams().do();
    suggestedParams.flatFee = true;
    suggestedParams.fee = BigInt(3000);
    const feeDelegationParams = await algodClient.getTransactionParams().do();
    feeDelegationParams.flatFee = true;
    feeDelegationParams.fee = BigInt(0);

    group.push(...[
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: OPERATIONAL_WALLET,
          receiver: user.walletAddress,
          amount: algosdk.algosToMicroalgos(0.1),
          suggestedParams,
        }),
        signerEmail: "operational",
        signerAddress: OPERATIONAL_WALLET,
      },
      {
        txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: user.walletAddress,
          receiver: user.walletAddress,
          amount: 0,
          assetIndex: Number(claim.badge.assetId),
          suggestedParams: feeDelegationParams,
        }),
        signerEmail: user.email,
        signerAddress: user.walletAddress,
      },
      {
        txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: claim.issuer.user.walletAddress,
          receiver: user.walletAddress,
          amount: 1,
          assetIndex: Number(claim.badge.assetId),
          suggestedParams: feeDelegationParams,
        }),
        signerEmail: claim.issuer.user.email,
        signerAddress: claim.issuer.user.walletAddress,
      },
    ]);

    const { bytes, txnIds } = await signTransactions(group);
    await algodClient.sendRawTransaction(bytes).do();
    await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);
    const txnId = txnIds[txnIds.length - 1];

    await prisma.$transaction([
      prisma.issuedBadge.create({
        data: {
          badgeId: claim.badge.id,
          receiverEmail: user.email,
          issuerId: claim.issuer.id,
          claimLinkId: claim.id,
          status: "CLAIMED",
          issuedAt: claim.createdAt,
          claimedAt: new Date(),
          transactionHash: txnId,
        },
      }),
      prisma.badgeClaimLink.update({
        where: { id: claim.id },
        data: {
          claimCount: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json({ txnId });
  } catch (error) {
    console.error("Failed to process badge action:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
