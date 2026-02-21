import { NextRequest, NextResponse } from "next/server";
import { requireIssuer } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateCredits, deductCredits } from "@/lib/services/creditManager";
import { queueProcessor } from "@/lib/services/queueProcessor";
import { JobStatus, MintingStatus } from "@prisma/client";

/**
 * POST /api/certificates/bulk/[jobId]/retry
 *
 * Re-queues all failed certificates in a bulk issuance job.
 */
export async function POST(
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
      include: { template: true },
    });

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (job.issuerId !== issuerId) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Find all failed certificates for this job
    const failedCertificates = await prisma.issuedCertificate.findMany({
      where: { jobId, mintingStatus: MintingStatus.FAILED },
    });

    if (failedCertificates.length === 0) {
      return NextResponse.json({ error: "No failed certificates to retry" }, { status: 400 });
    }

    const retryCount = failedCertificates.length;

    // Validate and deduct credits
    const creditValidation = await validateCredits(issuerId, retryCount);
    if (!creditValidation.valid) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Need ${retryCount}, have ${creditValidation.currentBalance}.`,
          required: retryCount,
          available: creditValidation.currentBalance,
        },
        { status: 400 }
      );
    }

    const creditDeduction = await deductCredits(issuerId, retryCount);
    if (!creditDeduction.success) {
      return NextResponse.json({ error: "Failed to process credit payment." }, { status: 500 });
    }

    // Get issuer details for queue tasks
    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      include: { user: true },
    });

    if (!issuer) {
      return NextResponse.json({ error: "Issuer not found" }, { status: 404 });
    }

    // Reset all failed certificates and re-enqueue
    await prisma.issuedCertificate.updateMany({
      where: { jobId, mintingStatus: MintingStatus.FAILED },
      data: {
        mintingStatus: MintingStatus.PENDING,
        errorMessage: null,
      },
    });

    const jobCustomProperties = (job.customProperties as Array<{ key: string; value: string }>) ?? [];

    for (const cert of failedCertificates) {
      const properties = cert.properties as Record<string, string>;
      await queueProcessor.enqueue({
        templateId: cert.templateId,
        recipientEmail: cert.receiverEmail,
        recipientName: properties.recipientName || properties.name || "Recipient",
        fieldData: properties,
        customProperties: jobCustomProperties,
        jobId,
        issuerId,
        issuerAddress: issuer.user.walletAddress,
        issuerEmail: issuer.user.email,
        issuerName: issuer.user.organizationName,
        certificateName: cert.certificateName,
        unitName: cert.unitName,
        description: cert.description,
        sendEmail: job.sendEmail,
      });
    }

    // Update job counters and status
    await prisma.bulkIssuanceJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PROCESSING,
        processedItems: { decrement: retryCount },
        failedItems: { decrement: retryCount },
      },
    });

    return NextResponse.json({ success: true, retriedCount: retryCount });
  } catch (error) {
    console.error("Error retrying failed certificates:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
