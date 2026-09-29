import prisma from "@/lib/prisma";
import { algodClient, OPERATIONAL_WALLET } from "@/lib/const";
import { signTransactions } from "@/lib/vault";
import { ensureOnboardingFund } from "@/lib/blockchain";
import algosdk from "algosdk";

export class BadgeClaimError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "BadgeClaimError";
  }
}

export interface BadgeClaimResult {
  txnId: string;
  issuerId: string;
}

/**
 * Opts the receiver into the badge ASA, transfers one unit from the issuer,
 * and records the IssuedBadge row. Shared by the free claim POST and the
 * x402-paid claim endpoint.
 */
export async function executeMagicLinkBadgeClaim(params: {
  claimId: string;
  receiverEmail: string;
  walletAddress: string;
}): Promise<BadgeClaimResult> {
  if (!params.walletAddress) {
    throw new BadgeClaimError("Your account has no wallet address yet", 400);
  }

  const claim = await prisma.badgeClaimLink.findFirst({
    where: { id: params.claimId },
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
    throw new BadgeClaimError("Claim not found", 404);
  }

  if (claim.claimCount >= claim.limit) {
    throw new BadgeClaimError("Claim limit reached", 400);
  }

  if (claim.issuedBadges.some((u) => u.receiverEmail === params.receiverEmail)) {
    throw new BadgeClaimError("Badge already claimed", 400);
  }

  const group = [];
  const onboardingFund = await ensureOnboardingFund(params.walletAddress);
  if (onboardingFund) {
    group.push(onboardingFund);
  }
  const suggestedParams = await algodClient.getTransactionParams().do();
  suggestedParams.flatFee = true;
  suggestedParams.fee = BigInt(3000);
  const feeDelegationParams = await algodClient.getTransactionParams().do();
  feeDelegationParams.flatFee = true;
  feeDelegationParams.fee = BigInt(0);

  group.push(
    {
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: OPERATIONAL_WALLET,
        receiver: params.walletAddress,
        amount: algosdk.algosToMicroalgos(0.1),
        suggestedParams,
      }),
      signerEmail: "operational",
      signerAddress: OPERATIONAL_WALLET,
    },
    {
      txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: params.walletAddress,
        receiver: params.walletAddress,
        amount: 0,
        assetIndex: Number(claim.badge.assetId),
        suggestedParams: feeDelegationParams,
      }),
      signerEmail: params.receiverEmail,
      signerAddress: params.walletAddress,
    },
    {
      txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: claim.issuer.user.walletAddress,
        receiver: params.walletAddress,
        amount: 1,
        assetIndex: Number(claim.badge.assetId),
        suggestedParams: feeDelegationParams,
      }),
      signerEmail: claim.issuer.user.email,
      signerAddress: claim.issuer.user.walletAddress,
    }
  );

  const { bytes, txnIds } = await signTransactions(group);
  await algodClient.sendRawTransaction(bytes).do();
  await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);
  const txnId = txnIds[txnIds.length - 1];

  await prisma.$transaction([
    prisma.issuedBadge.create({
      data: {
        badgeId: claim.badge.id,
        receiverEmail: params.receiverEmail,
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

  return { txnId, issuerId: claim.issuer.id };
}
