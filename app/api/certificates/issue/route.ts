import { NextRequest, NextResponse } from "next/server";
import { requireIssuer } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isValidEmail } from "@/lib/validators";
import { validateCredits, deductCredits, refundCredits } from "@/lib/services/creditManager";
import { generateCertificate } from "@/lib/services/imageGenerator";
import { uploadCertificateWithMetadata } from "@/lib/services/ipfsStorage";
import { blockchainMintingService } from "@/lib/services/blockchainMinting";
import { sendCertificateEmail } from "@/lib/services/emailNotification";

/**
 * POST /api/certificates/issue
 *
 * Single certificate issuance endpoint
 */
export async function POST(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) {
    return auth.error;
  }

  const { payload } = auth;
  const issuerId = payload.issuerId as string;

  try {
    const body = await req.json();
    const {
      templateId,
      recipientEmail,
      fieldData,
      customProperties,
      certificateName,
      unitName,
      description,
      sendEmail,
    } = body;

    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "Template ID is required." },
        { status: 400 }
      );
    }

    if (!recipientEmail || typeof recipientEmail !== "string") {
      return NextResponse.json(
        { error: "Recipient email is required." },
        { status: 400 }
      );
    }

    if (!fieldData || typeof fieldData !== "object") {
      return NextResponse.json(
        { error: "Field data is required." },
        { status: 400 }
      );
    }

    if (!certificateName || typeof certificateName !== "string") {
      return NextResponse.json(
        { error: "Certificate name is required." },
        { status: 400 }
      );
    }

    if (certificateName.length > 32) {
      return NextResponse.json(
        { error: "Certificate name must be less than 32 characters." },
        { status: 400 }
      );
    }

    if (!unitName || typeof unitName !== "string") {
      return NextResponse.json(
        { error: "Unit name is required." },
        { status: 400 }
      );
    }
    if (unitName.length > 8) {
      return NextResponse.json(
        { error: "Unit name must be less than 8 characters." },
        { status: 400 }
      );
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Description is required." },
        { status: 400 }
      );
    }

    if (!isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 }
      );
    }

    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found." },
        { status: 404 }
      );
    }

    if (template.issuerId !== issuerId) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }

    const dynamicFields = template.dynamicFields as Array<{ name: string }>;
    const templateFieldNames = dynamicFields.map((f) => f.name);
    const providedFieldNames = Object.keys(fieldData);

    for (const fieldName of templateFieldNames) {
      if (!providedFieldNames.includes(fieldName)) {
        return NextResponse.json(
          {
            error: `Missing required field: "${fieldName}".`,
            requiredFields: templateFieldNames,
            providedFields: providedFieldNames,
          },
          { status: 400 }
        );
      }
      const fieldValue = (fieldData as Record<string, string>)[fieldName];
      if (!fieldValue || fieldValue.trim() === "") {
        return NextResponse.json(
          { error: `Field "${fieldName}" must not be empty.` },
          { status: 400 }
        );
      }
    }

    // Validate and merge custom properties (no key conflicts with template fields)
    const safeCustomProps: Array<{ key: string; value: string }> = [];
    if (customProperties && Array.isArray(customProperties)) {
      for (const prop of customProperties) {
        if (!prop.key || prop.key.trim() === "") {
          return NextResponse.json(
            { error: "Custom property keys must not be empty." },
            { status: 400 }
          );
        }
        if (!prop.value || prop.value.trim() === "") {
          return NextResponse.json(
            { error: `Custom property "${prop.key}" must have a value.` },
            { status: 400 }
          );
        }
        if (templateFieldNames.includes(prop.key)) {
          return NextResponse.json(
            { error: `Custom property key "${prop.key}" conflicts with a template field name.` },
            { status: 400 }
          );
        }
        safeCustomProps.push({ key: String(prop.key), value: String(prop.value) });
      }
    }

    // Merge fieldData and custom properties into a single properties object
    const mergedProperties: Record<string, string> = { ...fieldData };
    for (const prop of safeCustomProps) {
      mergedProperties[prop.key] = prop.value;
    }

    const creditValidation = await validateCredits(issuerId, 1);
    if (!creditValidation.valid) {
      return NextResponse.json(
        {
          error: creditValidation.error || "Insufficient credits.",
          required: 1,
          available: creditValidation.currentBalance,
        },
        { status: 400 }
      );
    }

    const creditDeduction = await deductCredits(issuerId, 1);
    if (!creditDeduction.success) {
      return NextResponse.json(
        { error: "Failed to process credit payment.", details: creditDeduction.error },
        { status: 500 }
      );
    }

    let certificate = await prisma.issuedCertificate.create({
      data: {
        templateId,
        receiverEmail: recipientEmail,
        issuerId,
        certificateName,
        unitName,
        description,
        properties: mergedProperties,
        mintingStatus: "PENDING",
        status: "PENDING",
      },
    });

    try {
      const imageBuffer = await generateCertificate(templateId, fieldData);

      const { imageHash, metadataHash, imageUrl } = await uploadCertificateWithMetadata(
        imageBuffer,
        certificateName,
        unitName,
        description,
        mergedProperties
      );

      const issuer = await prisma.issuer.findUnique({
        where: { id: issuerId },
        include: { user: true },
      });

      if (!issuer) {
        throw new Error("Issuer not found");
      }

      const metadataUrl = `ipfs://${metadataHash}#arc3`;
      const mintResult = await blockchainMintingService.mintCertificate({
        issuerAddress: issuer.user.walletAddress,
        issuerEmail: issuer.user.email,
        certificateName,
        unitName,
        metadataUrl,
        recipientEmail,
      });

      // Update certificate: minting succeeded, status stays PENDING for recipient to claim
      certificate = await prisma.issuedCertificate.update({
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

      // Send email — failure here does NOT mark certificate as failed
      if (sendEmail !== false) {
        try {
          await sendCertificateEmail({
            recipientEmail,
            recipientName: (fieldData as Record<string, string>).recipientName
              || (fieldData as Record<string, string>).name
              || "Recipient",
            issuerName: issuer.user.organizationName,
            certificateName,
            certificateId: certificate.id,
            assetId: mintResult.assetId,
            imageUrl: `${process.env.PINATA_GATEWAY}${imageHash}`,
          });
        } catch (emailError) {
          console.error("[Issue] Email notification failed (non-fatal):", emailError);
        }
      }

      return NextResponse.json(
        {
          success: true,
          certificate: {
            id: certificate.id,
            assetId: certificate.assetId,
            imageCid: certificate.imageCid,
            mintingStatus: certificate.mintingStatus,
            status: certificate.status,
            mintTransactionHash: certificate.mintTransactionHash,
          },
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("Certificate minting failed:", error);

      await refundCredits(issuerId, 1);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await prisma.issuedCertificate.update({
        where: { id: certificate.id },
        data: {
          mintingStatus: "FAILED",
          errorMessage,
        },
      });

      let userMessage = "Certificate minting failed. Your credit has been refunded.";
      if (errorMessage.includes("Failed to load background image")) {
        userMessage = "Failed to load the template background image.";
      } else if (errorMessage.includes("Failed to upload")) {
        userMessage = "Failed to upload certificate to storage.";
      } else if (errorMessage.includes("Failed to mint")) {
        userMessage = "Failed to mint certificate on blockchain.";
      }

      return NextResponse.json(
        {
          error: userMessage,
          suggestion: "Your credit has been automatically refunded.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in certificate issuance endpoint:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
