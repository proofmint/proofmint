import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuerId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { issuerId } = await params;

  try {
    await prisma.issuer.update({
      where: { id: issuerId },
      data: { status: "REJECTED" },
    });
    return NextResponse.json({ message: "Issuer rejected" });
  } catch (e) {
    return NextResponse.json({ message: "Unable to reject issuer" }, { status: 500 });
  }
}


