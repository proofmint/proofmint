import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_WALLET, ONBOARDING_WALLET, algodClient } from "@/lib/const";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ message: "Invalid amount" }, { status: 400 });
    }

    const suggestedParams = await algodClient.getTransactionParams().do();
    const group = [
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: ADMIN_WALLET,
          receiver: ONBOARDING_WALLET,
          amount: algosdk.algosToMicroalgos(amount),
          suggestedParams,
        }),
        signerEmail: "admin",
        signerAddress: ADMIN_WALLET,
      },
    ];

    const { bytes, txnIds } = await signTransactions(group);
    await algodClient.sendRawTransaction(bytes).do();
    await algosdk.waitForConfirmation(algodClient, txnIds[0], 3);

    return NextResponse.json({
      message: "Transfer successful",
      transactionId: txnIds[0],
    });
  } catch (e) {
    console.error("Failed to transfer:", e);
    return NextResponse.json({ message: "Failed to transfer" }, { status: 500 });
  }
}
