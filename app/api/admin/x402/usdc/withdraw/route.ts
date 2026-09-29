import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { payToAccount } from "@/lib/x402/accounts";
import { usdcWithdrawResponse } from "@/lib/x402/usdcRoutes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const account = payToAccount();
  if ("error" in account) return account.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  return usdcWithdrawResponse(account, body);
}
