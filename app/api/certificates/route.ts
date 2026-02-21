import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET, ALGORAND_NETWORK, PINATA_GATEWAY } from "@/lib/const";
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
    const issuerId = (payload as Record<string, unknown>).issuerId as string | undefined;
    const userEmail = (payload as Record<string, unknown>).email as string;

    if (issuerId) {
      // Issuer: return single certificates and bulk jobs separately
      const [singleCertificates, bulkJobs] = await Promise.all([
        prisma.issuedCertificate.findMany({
          where: { issuerId, jobId: null },
          orderBy: { issuedAt: "desc" },
          include: { template: true },
        }),
        prisma.bulkIssuanceJob.findMany({
          where: { issuerId },
          orderBy: { createdAt: "desc" },
          include: {
            template: true,
            _count: { select: { issuedCertificates: true } },
          },
        }),
      ]);

      const recipientEmails = singleCertificates.map((c) => c.receiverEmail);
      const receivers = await prisma.user.findMany({
        where: { email: { in: recipientEmails } },
        select: { email: true, fullName: true },
      });

      const enrichedSingle = singleCertificates.map((cert) => ({
        ...cert,
        imageUrl: cert.imageCid ? `${PINATA_GATEWAY}${cert.imageCid}` : null,
      }));

      return NextResponse.json({ singleCertificates: enrichedSingle, bulkJobs, receivers });
    } else {
      // Receiver: only show minted certificates
      const certificates = await prisma.issuedCertificate.findMany({
        where: {
          receiverEmail: userEmail,
          mintingStatus: "MINTED",
        },
        orderBy: { issuedAt: "desc" },
        include: {
          template: true,
          issuer: { include: { user: true } },
        },
      });

      const enrichedCertificates = certificates.map((cert) => ({
        ...cert,
        imageUrl: cert.imageCid ? `${PINATA_GATEWAY}${cert.imageCid}` : null,
      }));

      return NextResponse.json({ certificates: enrichedCertificates, network: ALGORAND_NETWORK });
    }
  } catch (error) {
    console.error("Failed to fetch certificates:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
