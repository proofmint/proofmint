import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import {
  OPERATIONAL_WALLET,
  algodClient,
  ALGORAND_NETWORK,
  JWT_SECRET,
  PINATA_GATEWAY,
} from "@/lib/const";
import prisma from "@/lib/prisma";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import { ensureOnboardingFund } from "@/lib/blockchain";
import { requireIssuer } from "@/lib/auth";

// GET — issuer fetches full details for a single certificate (used by bulk job modal)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const { certificateId } = await params;
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;
  const issuerId = auth.payload.issuerId as string;

  try {
    const cert = await prisma.issuedCertificate.findFirst({
      where: { id: certificateId, issuerId },
    });

    if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const recipientUser = await prisma.user.findUnique({
      where: { email: cert.receiverEmail },
      select: { fullName: true },
    });

    return NextResponse.json({
      certificate: {
        ...cert,
        imageUrl: cert.imageCid ? `${PINATA_GATEWAY}${cert.imageCid}` : null,
        recipientName: recipientUser?.fullName ?? null,
        network: ALGORAND_NETWORK,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch certificate" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const { certificateId } = await params;

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

    const { action } = await req.json();

    if (!certificateId || !action) {
      return NextResponse.json(
        { error: "Certificate ID and action are required" },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    // Verify the certificate belongs to the receiver and has been minted
    const issuedCertificate = await prisma.issuedCertificate.findFirst({
      where: {
        id: certificateId,
        receiverEmail: userEmail,
        mintingStatus: "MINTED",
        status: "PENDING",
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
        template: true,
      },
    });

    if (!issuedCertificate) {
      return NextResponse.json(
        { error: "Certificate not found or already processed" },
        { status: 404 }
      );
    }

    let txnId = "";
    if (action === "accept") {
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

      group.push(
        ...[
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
              assetIndex: Number(issuedCertificate.assetId),
              suggestedParams: feeDelegationParams,
            }),
            signerEmail: user.email,
            signerAddress: user.walletAddress,
          },
          {
            txn: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              sender: issuedCertificate.issuer.user.walletAddress,
              receiver: user.walletAddress,
              amount: 1,
              assetIndex: Number(issuedCertificate.assetId),
              suggestedParams: feeDelegationParams,
            }),
            signerEmail: issuedCertificate.issuer.user.email,
            signerAddress: issuedCertificate.issuer.user.walletAddress,
          },
        ]
      );

      const { bytes, txnIds } = await signTransactions(group);
      await algodClient.sendRawTransaction(bytes).do();
      await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);
      txnId = txnIds[txnIds.length - 1];
    }

    // Update the badge status
    const updatedCertificate = await prisma.issuedCertificate.update({
      where: { id: certificateId },
      data: {
        status: action === "accept" ? "CLAIMED" : "REJECTED",
        claimedAt: action === "accept" ? new Date() : null,
        claimTransactionHash: txnId || null,
      },
    });

    return NextResponse.json({ updatedCertificate, network: ALGORAND_NETWORK });
  } catch (error) {
    console.error("Failed to process certificate action:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
