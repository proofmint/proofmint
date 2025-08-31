import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { requestId } = await params;
  const request = await prisma.creditPurchaseRequest.findUnique({ where: { id: requestId } });
  if (!request || !request.paymentProofBase64) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const buffer = Buffer.from(request.paymentProofBase64, "base64");
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}


