import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireIssuer } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;

  try {
    const issuer = await prisma.issuer.findUnique({ where: { id: auth.payload.issuerId! }, select: { creditBalance: true } });
    return NextResponse.json({ creditBalance: issuer?.creditBalance ?? 0 });
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch credits" }, { status: 500 });
  }
}


