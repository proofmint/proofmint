import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const { badgeId } = await params;
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

    const badge = await prisma.badge.findFirst({
      where: { 
        id: badgeId,
        issuerId: issuer.id 
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
