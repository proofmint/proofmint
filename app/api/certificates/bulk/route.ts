import { NextRequest, NextResponse } from "next/server";
import { requireIssuer } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseCSV } from "@/lib/utils/csvParser";
import { validateCredits, deductCredits } from "@/lib/services/creditManager";
import { queueProcessor } from "@/lib/services/queueProcessor";
import { JobStatus } from "@prisma/client";

/**
 * POST /api/certificates/bulk
 * 
 * Bulk certificate issuance endpoint
 * Accepts CSV file upload and queues certificate generation tasks
 * 
 * Requirements: 2.1, 10.2, 10.3
 */
export async function POST(req: NextRequest) {
  // Authenticate issuer
  const auth = await requireIssuer(req);
  if ("error" in auth) {
    return auth.error;
  }

  const { payload } = auth;
  const issuerId = payload.issuerId!;

  try {
    // Parse multipart form data
    const formData = await req.formData();
    const templateId = formData.get("templateId") as string;
    const csvFile = formData.get("csvFile") as File;

    // Validate required fields
    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "Template ID is required. Please select a template for bulk issuance." },
        { status: 400 }
      );
    }

    if (!csvFile || !(csvFile instanceof File)) {
      return NextResponse.json(
        { error: "CSV file is required. Please upload a CSV file containing recipient data." },
        { status: 400 }
      );
    }

    // Validate template exists and belongs to issuer
    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found. Please verify the template ID and try again." },
        { status: 404 }
      );
    }

    if (template.issuerId !== issuerId) {
      return NextResponse.json(
        { error: "Access denied. This template belongs to another issuer." },
        { status: 403 }
      );
    }

    // Parse CSV file
    let recipientData;
    try {
      const csvContent = await csvFile.text();
      recipientData = await parseCSV(csvContent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to parse CSV";
      return NextResponse.json(
        { 
          error: `CSV file is invalid: ${errorMessage}`,
          suggestion: "Please ensure your CSV file has an 'email' column and all required template fields. Check the file format and try again."
        },
        { status: 400 }
      );
    }

    // Calculate total credits needed (1 per recipient)
    const totalCredits = recipientData.length;

    // Validate issuer has sufficient credits
    const creditValidation = await validateCredits(issuerId, totalCredits);
    if (!creditValidation.valid) {
      return NextResponse.json(
        { 
          error: `Insufficient credits for bulk issuance. You need ${totalCredits} credits but only have ${creditValidation.currentBalance} available.`,
          required: totalCredits,
          available: creditValidation.currentBalance,
          shortage: totalCredits - creditValidation.currentBalance,
          suggestion: `Please purchase at least ${totalCredits - creditValidation.currentBalance} more credits to proceed with this bulk issuance.`
        },
        { status: 400 }
      );
    }

    // Create BulkIssuanceJob record with status PENDING
    const job = await prisma.bulkIssuanceJob.create({
      data: {
        issuerId,
        certificateTemplateId: templateId,
        recipientData: recipientData as any, // Store as JSON
        status: JobStatus.PENDING,
        totalItems: recipientData.length,
        processedItems: 0,
        failedItems: 0,
      },
    });

    // Deduct total credits atomically
    const creditDeduction = await deductCredits(issuerId, totalCredits);
    if (!creditDeduction.success) {
      // Delete the job if credit deduction fails
      await prisma.bulkIssuanceJob.delete({
        where: { id: job.id },
      });
      
      return NextResponse.json(
        { 
          error: "Failed to process credit payment. The bulk job has been cancelled.",
          suggestion: "Please try again or contact support if the issue persists.",
          details: creditDeduction.error
        },
        { status: 500 }
      );
    }

    // Get issuer details for queue tasks
    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      include: { user: true },
    });

    if (!issuer) {
      // Refund credits and delete job if issuer not found
      await prisma.bulkIssuanceJob.delete({
        where: { id: job.id },
      });
      
      return NextResponse.json(
        { 
          error: "Issuer account not found. This is an unexpected error.",
          suggestion: "Please contact support for assistance."
        },
        { status: 404 }
      );
    }

    // Enqueue certificate tasks for each recipient
    for (const recipient of recipientData) {
      await queueProcessor.enqueue({
        templateId,
        recipientEmail: recipient.email,
        recipientName: recipient.fieldData.recipientName || recipient.fieldData.name || "Recipient",
        fieldData: recipient.fieldData,
        jobId: job.id,
        issuerId,
        issuerAddress: issuer.user.walletAddress,
        issuerEmail: issuer.user.email,
        certificateName: template.templateName,
      });
    }

    // Update job status to PROCESSING
    await prisma.bulkIssuanceJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.PROCESSING,
      },
    });

    // Return job details immediately (don't wait for completion)
    return NextResponse.json(
      {
        success: true,
        job: {
          id: job.id,
          totalItems: job.totalItems,
          status: JobStatus.PROCESSING,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in bulk certificate issuance endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { 
        error: "An unexpected error occurred while creating the bulk issuance job.",
        suggestion: "Please verify your CSV file format and try again. Contact support if the issue persists."
      },
      { status: 500 }
    );
  }
}
