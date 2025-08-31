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
      include: {
        issuerProfile: true,
      },
    });

    // Ensure user is a valid, approved issuer
    if (!user || user.role !== "ISSUER" || !user.issuerProfile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      badges,
      claimedBadges,
      certificates,
      claimedCertificates,
      distinctBadgeRecipients,
      distinctCertificateRecipients,
    ] = await Promise.all([
      // Get total count of all issued badges
      prisma.issuedBadge.count({
        where: { issuerId: user.issuerProfile.id },
      }),
      // Get total count of claimed badges
      prisma.issuedBadge.count({
        where: { issuerId: user.issuerProfile.id, status: "CLAIMED" },
      }),
      // Get total count of all issued certificates
      prisma.issuedCertificate.count({
        where: { issuerId: user.issuerProfile.id },
      }),
      // Get total count of claimed certificates
      prisma.issuedCertificate.count({
        where: { issuerId: user.issuerProfile.id, status: "CLAIMED" },
      }),
      // Get distinct recipient emails for badges
      prisma.issuedBadge.findMany({
        where: { issuerId: user.issuerProfile.id },
        distinct: ["receiverEmail"],
        select: {
          receiverEmail: true,
        },
      }),
      // Get distinct recipient emails for certificates
      prisma.issuedCertificate.findMany({
        where: { issuerId: user.issuerProfile.id },
        distinct: ["receiverEmail"],
        select: {
          receiverEmail: true,
        },
      }),
    ]);

    // Calculate the total number of unique recipients
    const recipientEmails = new Set([
      ...distinctBadgeRecipients.map((b) => b.receiverEmail),
      ...distinctCertificateRecipients.map((c) => c.receiverEmail),
    ]);
    const totalRecipients = recipientEmails.size;

    // Calculate final metrics
    const totalBadgesIssued = badges;
    const totalCertificatesIssued = certificates;
    const totalIssued = totalBadgesIssued + totalCertificatesIssued;
    const totalClaimed = claimedBadges + claimedCertificates;

    // Calculate claim rate, avoiding division by zero
    const claimRate = totalIssued > 0 ? (totalClaimed / totalIssued) * 100 : 0;

    return NextResponse.json({
      totalBadgesIssued,
      totalCertificatesIssued,
      totalRecipients,
      claimRate,
    });
  } catch (error) {
    console.error("API error:", error);
    // Handle potential JWT errors (e.g., expired token)
    if (error instanceof Error && error.name === 'JWTExpired') {
        return NextResponse.json({ error: "Unauthorized: Token expired" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}