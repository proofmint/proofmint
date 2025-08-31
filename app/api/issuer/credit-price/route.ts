import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireIssuer } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;
  try {
    const row = await prisma.creditPrice.findFirst();
    return NextResponse.json({ value: row ? row.value : null, upiQrBase64: row?.upiQrBase64 ?? null });
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch" }, { status: 500 });
  }
}


