import { NextRequest } from "next/server";
import { issuerAccount } from "@/lib/x402/accounts";
import { usdcOptInResponse } from "@/lib/x402/usdcRoutes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await issuerAccount(req);
  if ("error" in account) return account.error;

  return usdcOptInResponse(account);
}
