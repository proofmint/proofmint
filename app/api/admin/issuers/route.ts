import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "PENDING";
  const allowed = new Set(["PENDING", "APPROVED", "REJECTED"]);
  const status = allowed.has(statusParam.toUpperCase()) ? statusParam.toUpperCase() : "PENDING";

  try {
    const issuers = await prisma.issuer.findMany({
      where: { status: status as any },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    const rows = issuers.map((i) => ({
      id: i.id,
      userEmail: i.user.email,
      organizationName: i.user.organizationName,
      websiteUrl: i.websiteUrl,
      status: i.status,
    }));

    return NextResponse.json({ issuers: rows });
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch issuers" }, { status: 500 });
  }
}


