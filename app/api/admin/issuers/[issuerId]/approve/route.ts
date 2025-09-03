import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ensureOnboardingFund } from "@/lib/blockchain";
import { signTransactions } from "@/lib/vault";
import algosdk from "algosdk";
import { algodClient } from "@/lib/const";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuerId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { issuerId } = await params;

  try {
    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      include: { user: { select: { walletAddress: true } } },
    });
    if (!issuer) {
      return NextResponse.json(
        { message: "Issuer not found" },
        { status: 404 }
      );
    }
    const onboardingFund = await ensureOnboardingFund(
      issuer.user.walletAddress
    );
    if (onboardingFund) {
      const txns = [onboardingFund];
      const { bytes, txnIds } = await signTransactions(txns);
      await algodClient.sendRawTransaction(bytes).do();
      await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);
    }

    await prisma.issuer.update({
      where: { id: issuerId },
      data: { status: "APPROVED" },
    });
    return NextResponse.json({ message: "Issuer approved" });
  } catch (e) {
    return NextResponse.json(
      { message: "Unable to approve issuer" },
      { status: 500 }
    );
  }
}
