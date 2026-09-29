import type { CertificateTemplate } from "@prisma/client";
import prisma from "@/lib/prisma";
import { generateCertificate } from "@/lib/services/imageGenerator";
import { uploadCertificateWithMetadata } from "@/lib/services/ipfsStorage";
import { blockchainMintingService } from "@/lib/services/blockchainMinting";
import { sendCertificateEmail } from "@/lib/services/emailNotification";
import { cleanString } from "@/lib/utils";

/** Per-certificate on-chain cost in ALGO, matching the cookie-authenticated routes. */
export const CERTIFICATE_BASE_COST = 0.102;
export const CERTIFICATE_UNIT_COST = 0.103;

export function certificateTotalCost(n: number): number {
  return CERTIFICATE_BASE_COST + n * CERTIFICATE_UNIT_COST;
}

export interface CertificateRequest {
  recipientEmail: string;
  certificateName: string;
  unitName: string;
  description?: string;
  fieldData: Record<string, string>;
  customProperties?: Array<{ key: string; value: string }>;
  /** Defaults to true, matching app/api/certificates/issue/route.ts:253. */
  sendEmail?: boolean;
}

/**
 * Validates one certificate request against its template and merges the
 * properties. Mirrors app/api/certificates/issue/route.ts:119-171 so both paths
 * enforce the same rules.
 */
export function buildProperties(
  template: CertificateTemplate,
  req: CertificateRequest
): { properties: Record<string, string> } | { error: string } {
  const dynamicFields = template.dynamicFields as Array<{ name: string }>;
  const templateFieldNames = dynamicFields.map((f) => f.name);

  for (const fieldName of templateFieldNames) {
    const value = req.fieldData?.[fieldName];
    if (value === undefined) {
      return { error: `Missing required field: "${fieldName}".` };
    }
    if (!value || String(value).trim() === "") {
      return { error: `Field "${fieldName}" must not be empty.` };
    }
  }

  const properties: Record<string, string> = { ...req.fieldData };
  for (const prop of req.customProperties ?? []) {
    if (!prop.key || prop.key.trim() === "") {
      return { error: "Custom property keys must not be empty." };
    }
    if (!prop.value || String(prop.value).trim() === "") {
      return { error: `Custom property "${prop.key}" must have a value.` };
    }
    if (templateFieldNames.includes(prop.key)) {
      return {
        error: `Custom property key "${prop.key}" conflicts with a template field name.`,
      };
    }
    properties[String(prop.key)] = String(prop.value);
  }

  return { properties };
}

export interface IssueResult {
  certificateId: string;
  assetId: string;
  txId: string;
  imageCid: string;
  metadataCid: string;
}

/**
 * Renders, pins and mints one certificate, then persists it.
 *
 * Does not touch credits -- callers own that, because the x402 routes settle
 * payment separately from the credit ledger. Throws on failure so the caller can
 * return a 4xx/5xx and leave the x402 payment unsettled.
 */
export async function issueCertificate(params: {
  issuerId: string;
  issuerAddress: string;
  issuerEmail: string;
  issuerName: string;
  template: CertificateTemplate;
  request: CertificateRequest;
  properties: Record<string, string>;
}): Promise<IssueResult> {
  const { issuerId, issuerAddress, issuerEmail, issuerName, template, request, properties } =
    params;

  const recipientEmail = cleanString(request.recipientEmail);
  const description = request.description ?? "";

  const certificate = await prisma.issuedCertificate.create({
    data: {
      templateId: template.id,
      receiverEmail: recipientEmail,
      issuerId,
      certificateName: request.certificateName,
      unitName: request.unitName,
      description,
      properties,
      mintingStatus: "PENDING",
      status: "PENDING",
    },
  });

  try {
    const imageBuffer = await generateCertificate(template.id, request.fieldData);

    const { imageHash, metadataHash, imageUrl } = await uploadCertificateWithMetadata(
      imageBuffer,
      request.certificateName,
      request.unitName,
      description,
      properties
    );

    const mintResult = await blockchainMintingService.mintCertificate({
      issuerAddress,
      issuerEmail,
      certificateName: request.certificateName,
      unitName: request.unitName,
      metadataUrl: `ipfs://${metadataHash}#arc3`,
      recipientEmail,
    });

    await prisma.issuedCertificate.update({
      where: { id: certificate.id },
      data: {
        assetId: mintResult.assetId,
        imageCid: imageHash,
        metadataCid: metadataHash,
        mintingStatus: "MINTED",
        status: "PENDING",
        mintTransactionHash: mintResult.transactionId,
      },
    });

    // Non-fatal and opt-out, matching app/api/certificates/issue/route.ts:252-269.
    if (request.sendEmail !== false) {
      try {
        await sendCertificateEmail({
          recipientEmail,
          recipientName: recipientEmail.split("@")[0],
          issuerName,
          certificateName: request.certificateName,
          certificateId: certificate.id,
          assetId: mintResult.assetId,
          imageUrl,
        });
      } catch (emailError) {
        console.error("[x402] certificate email failed", certificate.id, emailError);
      }
    }

    return {
      certificateId: certificate.id,
      assetId: mintResult.assetId,
      txId: mintResult.transactionId,
      imageCid: imageHash,
      metadataCid: metadataHash,
    };
  } catch (error) {
    await prisma.issuedCertificate.update({
      where: { id: certificate.id },
      data: {
        mintingStatus: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Minting failed",
      },
    });
    throw error;
  }
}
