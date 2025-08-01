import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;

    const issuer = await prisma.issuer.findUnique({
      where: { userId },
    });

    if (!issuer) {
      return NextResponse.json({ error: "Issuer not found" }, { status: 404 });
    }

    const badges = await prisma.badge.findMany({
      where: { issuerId: issuer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { issuedInstances: true, claimLinks: true },
        }
      }
    });

    return NextResponse.json(badges);

  } catch (error) {
    console.error("Failed to fetch badges:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
