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
      totalEmailBasedBadges,
      totalMagicLinkBadges,
      claimedBadges,
      certificates,
      claimedCertificates,
      distinctBadgeRecipients,
      distinctCertificateRecipients,
    ] = await Promise.all([
      // Get total count of email based issued badges
      prisma.issuedBadge.count({
        where: { issuerId: user.issuerProfile.id, claimLinkId: null },
      }),

      // Get total count of magic link type badges (via claim links)
      prisma.badgeClaimLink.aggregate({
        where: { issuerId: user.issuerProfile.id },
        _sum: { limit: true },
      }),
      // Get total count of claimed badges
      prisma.issuedBadge.count({
        where: {
          issuerId: user.issuerProfile.id,
          status: "CLAIMED",
        },
      }),
      // Get total count of all issued certificates
      prisma.issuedCertificate.count({
        where: { issuerId: user.issuerProfile.id },
      }),
      // Get total count of claimed certificates
      prisma.issuedCertificate.count({
        where: { issuerId: user.issuerProfile.id, status: "CLAIMED" },
      }),
      // Get count of distinct recipient emails for badges
      prisma.issuedBadge.groupBy({
        by: ["receiverEmail"],
        where: { issuerId: user.issuerProfile.id },
        _count: { receiverEmail: true },
      }),
      // Get count of distinct recipient emails for certificates
      prisma.issuedCertificate.groupBy({
        by: ["receiverEmail"],
        where: { issuerId: user.issuerProfile.id },
        _count: { receiverEmail: true },
      }),
    ]);

    // Calculate the total number of unique recipients (deduplicated across badges and certificates)
    const badgeRecipientEmails = distinctBadgeRecipients.map((b) => b.receiverEmail);
    const certificateRecipientEmails = distinctCertificateRecipients.map(
      (c) => c.receiverEmail
    );
    const totalRecipients = new Set([
      ...badgeRecipientEmails,
      ...certificateRecipientEmails,
    ]).size;

    // Calculate final metrics
    const totalBadgesIssued =
      (totalMagicLinkBadges._sum.limit || 0) + (totalEmailBasedBadges || 0);
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
    if (error instanceof Error && error.name === "JWTExpired") {
      return NextResponse.json(
        { error: "Unauthorized: Token expired" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
