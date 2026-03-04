import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { ALGORAND_NETWORK, JWT_SECRET } from "@/lib/const";
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
    const issuerId = (payload as any).issuerId as string | undefined;
    const userEmail = (payload as any).email as string;

    let badges;
    if (issuerId) {
      badges = await prisma.badge.findMany({
        where: { issuerId: issuerId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { issuedInstances: true },
          },
          claimLink: true,
        },
      });
    } else {
      const issuedBadges = await prisma.issuedBadge.findMany({
        where: { receiverEmail: userEmail },
        orderBy: { issuedAt: "desc" },
        include: {
          badge: true,
          issuer: {
            include: {
              user: true,
            },
          },
        },
      });
      badges = { badges: issuedBadges, network: ALGORAND_NETWORK };
    }

    return NextResponse.json(badges);
  } catch (error) {
    console.error("Failed to fetch badges:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
