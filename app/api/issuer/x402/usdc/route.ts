import { NextRequest } from "next/server";
import { issuerAccount } from "@/lib/x402/accounts";
import { usdcStatusResponse } from "@/lib/x402/usdcRoutes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const account = await issuerAccount(req);
  if ("error" in account) return account.error;

  return usdcStatusResponse(account);
}
