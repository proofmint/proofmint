import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET, ALGORAND_NETWORK } from "@/lib/const";
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

    if (issuerId) {
      const certificates = await prisma.issuedCertificate.findMany({
        where: { issuerId: issuerId },
        orderBy: { issuedAt: "desc" },
        include: {
          template: true,
        },
      });

      const recipients = certificates.map(
        (certificate) => certificate.receiverEmail
      );

      const receivers = await prisma.user.findMany({
        where: { email: { in: recipients } },
        select: { email: true, fullName: true },
      });

      return NextResponse.json({ certificates, receivers });
    } else {
      const certificates = await prisma.issuedCertificate.findMany({
        where: { receiverEmail: userEmail },
        orderBy: { issuedAt: "desc" },
        include: {
          template: true, // Include the badge details
          issuer: true, // Include the issuer details
        },
      });

      return NextResponse.json({ certificates, network: ALGORAND_NETWORK });
    }
  } catch (error) {
    console.error("Failed to fetch certificates:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
