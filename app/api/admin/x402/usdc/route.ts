import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { payToAccount } from "@/lib/x402/accounts";
import { usdcStatusResponse } from "@/lib/x402/usdcRoutes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const account = payToAccount();
  if ("error" in account) return account.error;

  return usdcStatusResponse(account);
}
