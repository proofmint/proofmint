import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { withX402FromHTTPServer } from "@x402/next";
import { httpServerForRoute } from "@/lib/x402/server";
import { certificateMintRoute } from "@/lib/x402/routes";
import { requireIssuerApiKey } from "@/lib/x402/apiKey";
import {
  corsOptions,
  mintMetaHeaders,
  withSettlementRecording,
} from "@/lib/x402/withSettlement";
import {
  buildProperties,
  certificateTotalCost,
  issueCertificate,
} from "@/lib/x402/certificateIssue";
import { deductCredits, refundCredits } from "@/lib/services/creditManager";
import { TransactionType } from "@prisma/client";
import { getDetailedBalances } from "@/lib/blockchain";
import { cleanString } from "@/lib/utils";
import { isValidEmail } from "@/lib/validators";
import { ALGORAND_NETWORK } from "@/lib/const";

export const runtime = "nodejs";

const bodySchema = z.object({
  templateId: z.string().min(1),
  recipientEmail: z.string().min(1),
  certificateName: z.string().min(1).max(32),
  unitName: z.string().min(1).max(8),
  description: z.string().optional(),
  fieldData: z.record(z.string(), z.string()),
  customProperties: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .optional(),
  sendEmail: z.boolean().optional(),
});

/**
 * Every failure path returns 4xx/5xx on purpose: withX402 settles the USDC
 * payment only when this handler resolves with a status below 400.
 */
const handler = async (req: NextRequest) => {
  const auth = await requireIssuerApiKey(req);
  if ("error" in auth) return auth.error;
  const { issuerId, walletAddress, email, organizationName, creditBalance } = auth.auth;

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

  const recipientEmail = cleanString(body.recipientEmail);
  if (!isValidEmail(recipientEmail)) {
    return NextResponse.json({ error: "recipientEmail is not a valid email" }, { status: 400 });
  }

  const template = await prisma.certificateTemplate.findUnique({
    where: { id: body.templateId },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (template.issuerId !== issuerId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const built = buildProperties(template, { ...body, recipientEmail });
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  if (creditBalance < 1) {
    return NextResponse.json(
      { error: "Insufficient credit balance to mint certificate" },
      { status: 402 }
    );
  }

  const totalCost = certificateTotalCost(1);
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

  const deduction = await deductCredits(issuerId, 1, TransactionType.MINT_CERTIFICATE);
  if (!deduction.success) {
    return NextResponse.json(
      { error: deduction.error || "Failed to deduct credits" },
      { status: 402 }
    );
  }

  let result;
  try {
    result = await issueCertificate({
      issuerId,
      issuerAddress: walletAddress,
      issuerEmail: email,
      issuerName: organizationName,
      template,
      request: { ...body, recipientEmail },
      properties: built.properties,
    });
  } catch (error) {
    await refundCredits(issuerId, 1, TransactionType.MINT_CERTIFICATE);
    console.error("[x402] certificate mint failed", error);
    return NextResponse.json(
      {
        error: "Certificate minting failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      certificateId: result.certificateId,
      assetId: result.assetId,
      txId: result.txId,
      explorerUrl: `https://allo.info/asset/${result.assetId}`,
      imageCid: result.imageCid,
      metadataCid: result.metadataCid,
      network: ALGORAND_NETWORK,
      recipientEmail,
    },
    {
      status: 200,
      headers: mintMetaHeaders({
        issuerId,
        quantity: 1,
        refId: result.certificateId,
      }),
    }
  );
};

export const POST = withSettlementRecording(
  withX402FromHTTPServer(
    handler,
    httpServerForRoute("POST /api/x402/certificates/mint", certificateMintRoute)
  ),
  "CERTIFICATE"
);

export const OPTIONS = async () => corsOptions();
