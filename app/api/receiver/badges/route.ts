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
    const userId = (payload as any).userId as string;
    const userEmail = (payload as any).email as string;

    // Check if the user is a receiver
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== "receiver") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all badges issued to the receiver
    const badges = await prisma.issuedBadge.findMany({
      where: { receiverEmail: userEmail },
      orderBy: { issuedAt: "desc" },
      include: {
        badge: true, // Include the badge details
        issuer: true, // Include the issuer details
      },
    });

    return NextResponse.json({ badges, network: ALGORAND_NETWORK });
  } catch (error) {
    console.error("Failed to fetch receiver badges:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
