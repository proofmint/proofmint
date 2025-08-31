import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const statusParam = (searchParams.get("status") || "PENDING").toUpperCase();
  const allowed = new Set(["PENDING", "APPROVED", "REJECTED"]);
  const status = allowed.has(statusParam) ? statusParam : "PENDING";

  try {
    const items = await prisma.creditPurchaseRequest.findMany({
      where: { status: status as any },
      include: { issuer: { include: { user: true } }, couponUsed: true },
      orderBy: { createdAt: "desc" },
    });

    const rows = items.map((r) => ({
      id: r.id,
      issuerEmail: r.issuer.user.email,
      creditsRequested: r.creditsRequested,
      amountPaid: String(r.amountPaid),
      paymentProofUrl: r.paymentProofBase64 ? `/api/admin/credit-requests/${r.id}/proof` : null,
      referenceNumber: r.referenceNumber,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return NextResponse.json({ requests: rows });
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch requests" }, { status: 500 });
  }
}


