import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const { badgeId } = await params;

  try {
    const badge = await prisma.badge.findFirst({
      where: { 
        id: badgeId,
      },
      include: {
        claimLinks: true,
        issuedInstances: true,
      },
    });

    if (!badge) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    const distributionType = badge.claimLinks.length > 0 ? 'magic' : 'email';

    const receiverEmails = badge.issuedInstances.map((instance) => instance.receiverEmail);

    const receiverUsers = await prisma.user.findMany({
      where: {
        email: { in: receiverEmails },
      },
    });

    return NextResponse.json({ ...badge, distributionType, receiverUsers });

  } catch (error) {
    console.error(`Failed to fetch badge ${badgeId}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
