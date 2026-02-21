import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireIssuer } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;

  const issuerId = auth.payload.issuerId as string;
  const { jobId } = await params;

  try {
    const job = await prisma.bulkIssuanceJob.findUnique({
      where: { id: jobId },
      include: {
        template: { select: { templateName: true } },
        issuedCertificates: {
          orderBy: { issuedAt: "asc" },
          select: {
            id: true,
            receiverEmail: true,
            mintingStatus: true,
            status: true,
            issuedAt: true,
            certificateName: true,
            errorMessage: true,
          },
        },
      },
    });

    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (job.issuerId !== issuerId) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Batch lookup recipient names from users table
    const emails = job.issuedCertificates.map((c) => c.receiverEmail);
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, fullName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.email, u.fullName]));

    const certificates = job.issuedCertificates.map((cert) => ({
      ...cert,
      recipientName: userMap[cert.receiverEmail] ?? null,
    }));

    return NextResponse.json({ job: { ...job, issuedCertificates: certificates } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
