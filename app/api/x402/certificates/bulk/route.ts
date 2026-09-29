import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { JobStatus, TransactionType } from "@prisma/client";
import { withX402FromHTTPServer } from "@x402/next";
import { httpServerForRoute } from "@/lib/x402/server";
import { certificateBulkRoute } from "@/lib/x402/routes";
import { requireIssuerApiKey } from "@/lib/x402/apiKey";
import {
  corsOptions,
  mintMetaHeaders,
  withSettlementRecording,
} from "@/lib/x402/withSettlement";
import { buildProperties, certificateTotalCost } from "@/lib/x402/certificateIssue";
import { deductCredits, validateCredits } from "@/lib/services/creditManager";
import { queueProcessor } from "@/lib/services/queueProcessor";
import { getDetailedBalances } from "@/lib/blockchain";
import { cleanString } from "@/lib/utils";
import { isValidEmail } from "@/lib/validators";
import { ALGORAND_NETWORK } from "@/lib/const";

export const runtime = "nodejs";

const bodySchema = z.object({
  templateId: z.string().min(1),
  certificateName: z.string().min(1).max(32),
  unitName: z.string().min(1).max(8),
  description: z.string().min(1),
  sendEmail: z.boolean().optional(),
  customProperties: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional(),
  recipients: z
    .array(
      z.object({
        recipientEmail: z.string().min(1),
        fieldData: z.record(z.string(), z.string()),
      })
    )
    .min(1),
});

/**
 * Bulk mint. The price was already fixed from the `count` query parameter when
 * the 402 challenge was built, so the first thing we do is assert the body
 * matches it -- otherwise a caller could pay for one and receive fifty.
 *
 * Work is queued rather than minted inline, matching POST /api/certificates/bulk:
 * every recipient gets an IssuedCertificate row in PENDING and a queue task, and
 * the response returns the job to poll. The tradeoff is that the USDC settles
 * when the job is *accepted*, not when each ASA lands -- a recipient that fails
 * later is refunded in credits by the queue processor, not in USDC.
 */
const handler = async (req: NextRequest) => {
  const auth = await requireIssuerApiKey(req);
  if ("error" in auth) return auth.error;
  const { issuerId, walletAddress, email, organizationName } = auth.auth;

  const count = Number(req.nextUrl.searchParams.get("count"));

  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }
  const body = parsed.data;
  const sendEmail = body.sendEmail !== false;
  const customProperties = body.customProperties ?? [];

  if (body.recipients.length !== count) {
    return NextResponse.json(
      {
        error: "recipients length must equal the count query parameter",
        count,
        recipients: body.recipients.length,
      },
      { status: 400 }
    );
  }

  const template = await prisma.certificateTemplate.findUnique({
    where: { id: body.templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (template.issuerId !== issuerId) {
    return NextResponse.json(
      { error: "Template does not belong to this issuer" },
      { status: 403 }
    );
  }

  // Validate every recipient before anything is created, so a bad row cannot
  // leave a half-built job behind.
  const prepared: Array<{
    recipientEmail: string;
    fieldData: Record<string, string>;
    properties: Record<string, string>;
  }> = [];

  for (let i = 0; i < body.recipients.length; i++) {
    const r = body.recipients[i];
    const recipientEmail = cleanString(r.recipientEmail);
    if (!isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: `recipients[${i}].recipientEmail is not a valid email` },
        { status: 400 }
      );
    }
    const built = buildProperties(template, {
      recipientEmail,
      certificateName: body.certificateName,
      unitName: body.unitName,
      description: body.description,
      fieldData: r.fieldData,
      customProperties,
    });
    if ("error" in built) {
      return NextResponse.json(
        { error: `recipients[${i}]: ${built.error}` },
        { status: 400 }
      );
    }
    prepared.push({
      recipientEmail,
      fieldData: r.fieldData,
      properties: built.properties,
    });
  }

  // The USDC payment is charged in addition to credits, so the issuer must hold
  // one credit per certificate before the job is accepted.
  const creditValidation = await validateCredits(issuerId, count);
  if (!creditValidation.valid) {
    return NextResponse.json(
      {
        error: `Insufficient credits. Need ${count}, have ${creditValidation.currentBalance}.`,
        required: count,
        available: creditValidation.currentBalance,
      },
      { status: 402 }
    );
  }

  const totalCost = certificateTotalCost(count);
  const { deltaBalance } = await getDetailedBalances(walletAddress);
  if (deltaBalance < totalCost) {
    return NextResponse.json(
      {
        error: "Issuer wallet is underfunded",
        requiredAlgo: totalCost,
        availableAlgo: deltaBalance,
      },
      { status: 400 }
    );
  }

  const job = await prisma.bulkIssuanceJob.create({
    data: {
      issuerId,
      certificateTemplateId: body.templateId,
      certificateName: body.certificateName,
      unitName: body.unitName,
      description: body.description,
      sendEmail,
      customProperties: customProperties as unknown as object,
      recipientData: prepared.map((p) => ({
        email: p.recipientEmail,
        fieldData: p.fieldData,
      })) as unknown as object,
      status: JobStatus.PENDING,
      totalItems: count,
      processedItems: 0,
      failedItems: 0,
    },
  });

  const deduction = await deductCredits(issuerId, count, TransactionType.MINT_CERTIFICATE);
  if (!deduction.success) {
    await prisma.bulkIssuanceJob.delete({ where: { id: job.id } });
    return NextResponse.json(
      { error: deduction.error || "Failed to deduct credits" },
      { status: 402 }
    );
  }

  // Certificate rows are created up front in PENDING so the job survives a
  // restart: recovery re-enqueues whatever is still PENDING.
  let createdCertificates;
  try {
    createdCertificates = await Promise.all(
      prepared.map((p) =>
        prisma.issuedCertificate.create({
          data: {
            templateId: body.templateId,
            receiverEmail: p.recipientEmail,
            issuerId,
            jobId: job.id,
            certificateName: body.certificateName,
            unitName: body.unitName,
            description: body.description,
            properties: p.properties,
            mintingStatus: "PENDING",
            status: "PENDING",
          },
        })
      )
    );
  } catch (error) {
    console.error("[x402] failed to create bulk certificate rows", error);
    await prisma.bulkIssuanceJob.delete({ where: { id: job.id } });
    return NextResponse.json(
      { error: "Failed to create the bulk issuance job" },
      { status: 500 }
    );
  }

  await prisma.bulkIssuanceJob.update({
    where: { id: job.id },
    data: { status: JobStatus.PROCESSING },
  });

  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i];
    await queueProcessor.enqueue({
      certificateId: createdCertificates[i].id,
      templateId: body.templateId,
      recipientEmail: p.recipientEmail,
      recipientName: p.fieldData.recipientName || p.fieldData.name || "Recipient",
      fieldData: p.fieldData,
      customProperties,
      jobId: job.id,
      issuerId,
      issuerAddress: walletAddress,
      issuerEmail: email,
      issuerName: organizationName,
      certificateName: body.certificateName,
      unitName: body.unitName,
      description: body.description,
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
      network: ALGORAND_NETWORK,
    },
    {
      status: 200,
      headers: mintMetaHeaders({ issuerId, quantity: count, refId: job.id }),
    }
  );
};

const paid = withSettlementRecording(
  withX402FromHTTPServer(
    handler,
    httpServerForRoute("POST /api/x402/certificates/bulk", certificateBulkRoute)
  ),
  "CERTIFICATE_BULK"
);

/**
 * `count` is validated before the payment flow starts. The dynamic price is a
 * function of it, and a price function that throws surfaces as an opaque 500 --
 * so a bad count has to be rejected as a plain 400 here, up front.
 */
export const POST = async (req: NextRequest) => {
  const count = Number(req.nextUrl.searchParams.get("count"));
  if (!Number.isInteger(count) || count < 1) {
    return NextResponse.json(
      { error: "count query parameter must be a positive integer" },
      { status: 400 }
    );
  }
  return paid(req);
};

export const OPTIONS = async () => corsOptions();
