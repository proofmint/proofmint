import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";

export async function GET(req: NextRequest) {
  const token = (await cookies()).get("token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET), {});
    const userId = (payload as any).userId as string;
    const issuer = await prisma.issuer.findUnique({ where: { userId } });
    if (!issuer) return NextResponse.json({ message: "Issuer not found" }, { status: 404 });
    const jobs = await prisma.bulkIssuanceJob.findMany({ where: { issuerId: issuer.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}


