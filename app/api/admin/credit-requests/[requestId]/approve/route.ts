import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { ADMIN_WALLET, algodClient } from "@/lib/const";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import { ensureOnboardingFund } from "@/lib/blockchain";

const schema = z.object({ adminNotes: z.string().optional().nullable() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { requestId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed" },
        { status: 400 }
      );
    }

    const request = await prisma.creditPurchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        issuer: { include: { user: { select: { walletAddress: true } } } },
      },
    });
    if (!request)
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { message: "Request is not pending" },
        { status: 400 }
      );
    }

    const group = [];
    const onboardingFund = await ensureOnboardingFund(request.issuer.user.walletAddress);
    if (onboardingFund) {
      group.push(onboardingFund);
    }
    const suggestedParams = await algodClient.getTransactionParams().do();
    group.push(...[
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: ADMIN_WALLET,
          receiver: request.issuer.user.walletAddress,
          amount: algosdk.algosToMicroalgos(0.21 * request.creditsRequested),
          suggestedParams,
        }),
        signerEmail: "admin",
        signerAddress: ADMIN_WALLET,
      },
    ]);

    const { bytes, txnIds } = await signTransactions(group);
    await algodClient.sendRawTransaction(bytes).do();
    await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);

    // Approve request and grant credits
    await prisma.$transaction([
      prisma.creditPurchaseRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          adminNotes: parsed.data.adminNotes ?? null,
        },
      }),
      prisma.issuer.update({
        where: { id: request.issuerId },
        data: { creditBalance: { increment: request.creditsRequested } },
      }),
      prisma.creditTransaction.create({
        data: {
          issuerId: request.issuerId,
          type: "PURCHASE",
          amount: request.creditsRequested,
        },
      }),
    ]);

    return NextResponse.json({ message: "Approved" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}
