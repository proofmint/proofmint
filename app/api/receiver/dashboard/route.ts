import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });

    if (!user || user.role !== "RECEIVER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      badges,
      pendingBadges,
      claimedBadges,
      rejectedBadges,
      certificates,
      pendingCertificates,
      claimedCertificates,
      rejectedCertificates,
    ] = await Promise.all([
      prisma.issuedBadge.count({
        where: { receiverEmail: user.email },
      }),
      prisma.issuedBadge.count({
        where: { receiverEmail: user.email, status: "PENDING" },
      }),
      prisma.issuedBadge.count({
        where: { receiverEmail: user.email, status: "CLAIMED" },
      }),
      prisma.issuedBadge.count({
        where: { receiverEmail: user.email, status: "REJECTED" },
      }),
      prisma.issuedCertificate.count({
        where: { receiverEmail: user.email },
      }),
      prisma.issuedCertificate.count({
        where: { receiverEmail: user.email, status: "PENDING" },
      }),
      prisma.issuedCertificate.count({
        where: { receiverEmail: user.email, status: "CLAIMED" },
      }),
      prisma.issuedCertificate.count({
        where: { receiverEmail: user.email, status: "REJECTED" },
      }),
    ]);

    const totalCredentials = certificates + badges;
    const totalPendingCredentials = pendingCertificates + pendingBadges;
    const totalClaimedCredentials = claimedCertificates + claimedBadges;
    const totalRejectedCredentials = rejectedCertificates + rejectedBadges;

    return NextResponse.json({
      totalCredentials,
      totalPendingCredentials,
      totalClaimedCredentials,
      totalRejectedCredentials,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}