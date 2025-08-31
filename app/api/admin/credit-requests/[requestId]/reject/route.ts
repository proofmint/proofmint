import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ adminNotes: z.string().optional().nullable() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { requestId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const request = await prisma.creditPurchaseRequest.findUnique({ where: { id: requestId } });
    if (!request) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (request.status !== "PENDING") {
      return NextResponse.json({ message: "Request is not pending" }, { status: 400 });
    }

    await prisma.creditPurchaseRequest.update({ where: { id: request.id }, data: { status: "REJECTED", adminNotes: parsed.data.adminNotes ?? null } });
    return NextResponse.json({ message: "Rejected" });
  } catch (e) {
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}


