import { NextRequest, NextResponse } from "next/server";
import { requireIssuer } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseCSV } from "@/lib/utils/csvParser";
import { validateCredits, deductCredits } from "@/lib/services/creditManager";
import { queueProcessor } from "@/lib/services/queueProcessor";
import { JobStatus } from "@prisma/client";
import { isValidEmail } from "@/lib/validators";

/**
 * POST /api/certificates/bulk
 *
 * Bulk certificate issuance endpoint.
 * Accepts CSV file upload and queues certificate generation tasks.
 */
export async function POST(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) {
    return auth.error;
  }

  const { payload } = auth;
  const issuerId = payload.issuerId as string;

  try {
    const formData = await req.formData();
    const templateId = formData.get("templateId") as string;
    const csvFile = formData.get("csvFile") as File;
    const certificateName = formData.get("certificateName") as string;
    const unitName = formData.get("unitName") as string;
    const description = formData.get("description") as string;
    const sendEmailRaw = formData.get("sendEmail") as string;
    const sendEmail = sendEmailRaw !== "false";
    const customPropertiesRaw = formData.get("customProperties") as string;
    let customProperties: Array<{ key: string; value: string }> = [];
    if (customPropertiesRaw) {
      try {
        customProperties = JSON.parse(customPropertiesRaw);
      } catch {
        customProperties = [];
      }
    }

    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json({ error: "Template ID is required." }, { status: 400 });
    }

    if (!csvFile || !(csvFile instanceof File)) {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    if (!certificateName || typeof certificateName !== "string") {
      return NextResponse.json({ error: "Certificate name is required." }, { status: 400 });
    }
    if (certificateName.length > 32) {
      return NextResponse.json({ error: "Certificate name must be 32 characters or fewer." }, { status: 400 });
    }

    if (!unitName || typeof unitName !== "string") {
      return NextResponse.json({ error: "Unit name is required." }, { status: 400 });
    }
    if (unitName.length > 8) {
      return NextResponse.json({ error: "Unit name must be 8 characters or fewer." }, { status: 400 });
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    // Validate custom property keys and values are non-empty
    for (const prop of customProperties) {
      if (!prop.key || typeof prop.key !== "string" || prop.key.trim() === "") {
        return NextResponse.json({ error: "Custom property keys must not be empty." }, { status: 400 });
      }
      if (!prop.value || typeof prop.value !== "string" || prop.value.trim() === "") {
        return NextResponse.json({ error: `Custom property "${prop.key}" must have a value.` }, { status: 400 });
      }
    }

    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    if (template.issuerId !== issuerId) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Validate custom property keys don't conflict with template dynamic fields
    const dynamicFields = template.dynamicFields as Array<{ name: string }>;
    const templateFieldNames = dynamicFields.map((f) => f.name);
    for (const prop of customProperties) {
      if (templateFieldNames.includes(prop.key)) {
        return NextResponse.json(
          { error: `Custom property key "${prop.key}" conflicts with a template field name.` },
          { status: 400 }
        );
      }
    }

    let recipientData;
    try {
      const csvContent = await csvFile.text();
      recipientData = await parseCSV(csvContent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to parse CSV";
      return NextResponse.json({ error: `CSV file is invalid: ${errorMessage}` }, { status: 400 });
    }

    if (recipientData.length === 0) {
      return NextResponse.json({ error: "CSV file contains no recipients." }, { status: 400 });
    }

    // Validate each recipient's email and required template fields
    for (let i = 0; i < recipientData.length; i++) {
      const recipient = recipientData[i];
      const rowNum = i + 2; // 1-based, row 1 is header

      if (!isValidEmail(recipient.email)) {
        return NextResponse.json(
          { error: `Row ${rowNum}: Invalid email address "${recipient.email}".` },
          { status: 400 }
        );
      }

      for (const fieldName of templateFieldNames) {
        if (!recipient.fieldData[fieldName] || recipient.fieldData[fieldName].trim() === "") {
          return NextResponse.json(
            { error: `Row ${rowNum}: Missing required field "${fieldName}" for recipient "${recipient.email}".` },
            { status: 400 }
          );
        }
      }
    }

    const totalCredits = recipientData.length;

    const creditValidation = await validateCredits(issuerId, totalCredits);
    if (!creditValidation.valid) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Need ${totalCredits}, have ${creditValidation.currentBalance}.`,
          required: totalCredits,
          available: creditValidation.currentBalance,
        },
        { status: 400 }
      );
    }

    const job = await prisma.bulkIssuanceJob.create({
      data: {
        issuerId,
        certificateTemplateId: templateId,
        certificateName,
        unitName,
        description,
        sendEmail,
        customProperties: customProperties as unknown as object,
        recipientData: recipientData as unknown as object,
        status: JobStatus.PENDING,
        totalItems: recipientData.length,
        processedItems: 0,
        failedItems: 0,
      },
    });

    const creditDeduction = await deductCredits(issuerId, totalCredits);
    if (!creditDeduction.success) {
      await prisma.bulkIssuanceJob.delete({ where: { id: job.id } });
      return NextResponse.json(
        { error: "Failed to process credit payment. The bulk job has been cancelled." },
        { status: 500 }
      );
    }

    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      include: { user: true },
    });

    if (!issuer) {
      await prisma.bulkIssuanceJob.delete({ where: { id: job.id } });
      return NextResponse.json({ error: "Issuer account not found." }, { status: 404 });
    }

    // Pre-create all certificate records in PENDING state so they survive a server crash.
    // Recovery on server restart will re-enqueue any still-PENDING records.
    const mergedCustom: Record<string, string> = {};
    for (const prop of customProperties) {
      mergedCustom[prop.key] = prop.value;
    }

    const createdCertificates = await Promise.all(
      recipientData.map((recipient) =>
        prisma.issuedCertificate.create({
          data: {
            templateId,
            receiverEmail: recipient.email,
            issuerId,
            jobId: job.id,
            certificateName,
            unitName,
            description,
            properties: { ...recipient.fieldData, ...mergedCustom },
            mintingStatus: "PENDING",
            status: "PENDING",
          },
        })
      )
    );

    await prisma.bulkIssuanceJob.update({
      where: { id: job.id },
      data: { status: JobStatus.PROCESSING },
    });

    for (let i = 0; i < recipientData.length; i++) {
      const recipient = recipientData[i];
      const certificate = createdCertificates[i];
      await queueProcessor.enqueue({
        certificateId: certificate.id,
        templateId,
        recipientEmail: recipient.email,
        recipientName:
          recipient.fieldData.recipientName || recipient.fieldData.name || "Recipient",
        fieldData: recipient.fieldData,
        customProperties,
        jobId: job.id,
        issuerId,
        issuerAddress: issuer.user.walletAddress,
        issuerEmail: issuer.user.email,
        issuerName: issuer.user.organizationName,
        certificateName,
        unitName,
        description,
        sendEmail,
      });
    }

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
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the bulk issuance job." },
      { status: 500 }
    );
  }
}
