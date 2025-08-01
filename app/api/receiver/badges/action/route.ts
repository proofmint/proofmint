import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { adminWallet, algodClient, JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";

export async function POST(req: NextRequest) {
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

    if (!user || user.role !== "receiver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { badgeId, action } = await req.json();

    if (!badgeId || !action) {
      return NextResponse.json(
        { error: "Badge ID and action are required" },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    // Verify the badge belongs to the receiver
    const issuedBadge = await prisma.issuedBadge.findFirst({
      where: {
        id: badgeId,
        receiverEmail: userEmail,
        status: "pending", // Only allow action on pending badges
      },
      include: {
        issuer: {
          include: {
            user: {
              select: {
                walletAddress: true,
                email: true,
              },
            },
          },
        },
        badge: {
          select: {
            assetId: true,
          },
        },
      },
    });

    if (!issuedBadge) {
      return NextResponse.json(
        { error: "Badge not found or already processed" },
        { status: 404 }
      );
    }

    let txnId = "";
    if (action === "accept") {
      const suggestedParams = await algodClient.getTransactionParams().do();
      suggestedParams.flatFee = true;
      suggestedParams.fee = BigInt(3000);
      const feeDelegationParams = await algodClient.getTransactionParams().do();
      feeDelegationParams.flatFee = true;
      feeDelegationParams.fee = BigInt(0);

      const group = [
        {
          txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: adminWallet.addr.toString(),
            receiver: user.walletAddress,
            amount: algosdk.algosToMicroalgos(0.1),
            suggestedParams,
          }),
          signerEmail: "",
          signerAddress: adminWallet.addr.toString(),
        },
        {
          txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: user.walletAddress,
            receiver: user.walletAddress,
            amount: 0,
            assetIndex: Number(issuedBadge.badge.assetId),
            suggestedParams: feeDelegationParams,
          }),
          signerEmail: user.email,
          signerAddress: user.walletAddress,
        },
        {
          txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: issuedBadge.issuer.user.walletAddress,
            receiver: user.walletAddress,
            amount: 1,
            assetIndex: Number(issuedBadge.badge.assetId),
            suggestedParams: feeDelegationParams,
          }),
          signerEmail: issuedBadge.issuer.user.email,
          signerAddress: issuedBadge.issuer.user.walletAddress,
        },
      ];

      const { bytes, txnIds } = await signTransactions(group);
      await algodClient.sendRawTransaction(bytes).do();
      await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);
      txnId = txnIds[2];
    }

    // Update the badge status
    const updatedBadge = await prisma.issuedBadge.update({
      where: { id: badgeId },
      data: {
        status: action === "accept" ? "claimed" : "rejected",
        claimedAt: action === "accept" ? new Date() : null,
        transactionHash: txnId,
      },
    });

    return NextResponse.json(updatedBadge);
  } catch (error) {
    console.error("Failed to process badge action:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
