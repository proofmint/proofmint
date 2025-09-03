import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const [pendingIssuers, pendingCreditRequests, activeCoupons] = await Promise.all([
      prisma.issuer.count({ where: { status: "PENDING" } }),
      prisma.creditPurchaseRequest.count({ where: { status: "PENDING" } }),
      prisma.coupon.count({ where: { isActive: true, AND: { expiresAt: { gte: new Date() } } } }),
    ]);

    return NextResponse.json({
      pendingIssuers,
      pendingCreditRequests,
      activeCoupons,
    });
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch dashboard counts" }, { status: 500 });
  }
}


