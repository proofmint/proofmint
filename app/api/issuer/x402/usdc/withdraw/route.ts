import { NextRequest, NextResponse } from "next/server";
import { issuerAccount } from "@/lib/x402/accounts";
import { usdcWithdrawResponse } from "@/lib/x402/usdcRoutes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await issuerAccount(req);
  if ("error" in account) return account.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  return usdcWithdrawResponse(account, body);
}
