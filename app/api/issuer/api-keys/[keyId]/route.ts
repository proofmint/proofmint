import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireIssuer } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;

  const { keyId } = await params;
  const key = await prisma.issuerApiKey.findUnique({ where: { id: keyId } });

  if (!key || key.issuerId !== auth.payload.issuerId) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  if (key.revokedAt) {
    return NextResponse.json({ error: "Key is already revoked" }, { status: 400 });
  }

  await prisma.issuerApiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ revoked: true });
}
