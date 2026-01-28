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
 * 
 * Requirements: 1.1, 10.1, 10.3
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
    // Parse request body
    const body = await req.json();
    const { templateId, recipientEmail, fieldData } = body;

    // Validate required fields
    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "Template ID is required. Please provide a valid template ID." },
        { status: 400 }
      );
    }

    if (!recipientEmail || typeof recipientEmail !== "string") {
      return NextResponse.json(
        { error: "Recipient email is required. Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!fieldData || typeof fieldData !== "object") {
      return NextResponse.json(
        { error: "Field data is required. Please provide certificate field values as an object." },
        { status: 400 }
      );
    }

    // Validate recipient email format
    if (!isValidEmail(recipientEmail)) {
      return NextResponse.json(
        { error: "Invalid email format. Please provide a valid email address (e.g., user@example.com)." },
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

    // Validate field data matches template fields
    const dynamicFields = template.dynamicFields as any[];
    const templateFieldNames = dynamicFields.map((f) => f.name);
    const providedFieldNames = Object.keys(fieldData);

    // Check if all template fields are provided
    for (const fieldName of templateFieldNames) {
      if (!providedFieldNames.includes(fieldName)) {
        return NextResponse.json(
          { 
            error: `Missing required field: "${fieldName}". Please provide values for all template fields.`,
            requiredFields: templateFieldNames,
            providedFields: providedFieldNames
          },
          { status: 400 }
        );
      }
    }

    // Validate and deduct credits (1 credit for single issuance)
    const creditValidation = await validateCredits(issuerId, 1);
    if (!creditValidation.valid) {
      return NextResponse.json(
        { 
          error: creditValidation.error || "Insufficient credits to issue certificate.",
          required: 1,
          available: creditValidation.currentBalance,
          suggestion: "Please purchase more credits to continue issuing certificates."
        },
        { status: 400 }
      );
    }

    const creditDeduction = await deductCredits(issuerId, 1);
    if (!creditDeduction.success) {
      return NextResponse.json(
        { 
          error: "Failed to process credit payment. Please try again or contact support if the issue persists.",
          details: creditDeduction.error
        },
        { status: 500 }
      );
    }

    // Create IssuedCertificate record with status PENDING
    let certificate = await prisma.issuedCertificate.create({
      data: {
        assetId: "", // Will be updated after minting
        templateId,
        receiverEmail: recipientEmail,
        issuerId,
        fieldData,
        generatedImageUrl: "", // Will be updated after IPFS upload
        status: "PENDING",
      },
    });

    try {
      // Generate certificate image
      const imageBuffer = await generateCertificate(templateId, fieldData);

      // Upload image and metadata to IPFS
      const { imageHash, metadataHash, imageUrl } = await uploadCertificateWithMetadata(
        imageBuffer,
        template.templateName,
        template.templateDescription,
        fieldData
      );

      // Get issuer details for minting
      const issuer = await prisma.issuer.findUnique({
        where: { id: issuerId },
        include: { user: true },
      });

      if (!issuer) {
        throw new Error("Issuer not found");
      }

      // Mint NFT on Algorand
      const metadataUrl = `ipfs://${metadataHash}#arc3`;
      const mintResult = await blockchainMintingService.mintCertificate({
        issuerAddress: issuer.user.walletAddress,
        issuerEmail: issuer.user.email,
        certificateName: template.templateName,
        unitName: template.templateName.substring(0, 8).toUpperCase(),
        metadataUrl,
        recipientEmail,
      });

      // Update certificate status to CLAIMED (representing minted)
      certificate = await prisma.issuedCertificate.update({
        where: { id: certificate.id },
        data: {
          assetId: mintResult.assetId,
          generatedImageUrl: imageUrl,
          status: "CLAIMED",
          transactionHash: mintResult.transactionId,
          claimedAt: new Date(),
        },
      });

      // Send email notification (failures are logged but don't fail issuance)
      await sendCertificateEmail({
        recipientEmail,
        recipientName: fieldData.recipientName || fieldData.name || "Recipient",
        certificateName: template.templateName,
        assetId: mintResult.assetId,
        imageUrl,
      });

      // Return certificate details
      return NextResponse.json(
        {
          success: true,
          certificate: {
            id: certificate.id,
            assetId: certificate.assetId,
            generatedImageUrl: certificate.generatedImageUrl,
            status: certificate.status,
            transactionHash: certificate.transactionHash,
          },
        },
        { status: 200 }
      );
    } catch (error) {
      // Error handling and rollback
      console.error("Certificate issuance failed:", error);

      // Refund credits
      await refundCredits(issuerId, 1);

      // Update certificate status to REJECTED
      await prisma.issuedCertificate.update({
        where: { id: certificate.id },
        data: {
          status: "REJECTED",
        },
      });

      // Return user-friendly error response
      let userMessage = "Certificate issuance failed. Your credit has been refunded.";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage.includes("Template not found")) {
        userMessage = "The certificate template could not be found. Please verify the template exists.";
      } else if (errorMessage.includes("Failed to load background image")) {
        userMessage = "Failed to load the template background image. Please check the template configuration.";
      } else if (errorMessage.includes("Failed to upload")) {
        userMessage = "Failed to upload certificate to storage. Please check your internet connection and try again.";
      } else if (errorMessage.includes("Failed to mint")) {
        userMessage = "Failed to mint certificate on blockchain. Please try again or contact support.";
      }
      
      return NextResponse.json(
        { 
          error: userMessage,
          suggestion: "Your credit has been automatically refunded. Please try again or contact support if the issue persists."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in certificate issuance endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { 
        error: "An unexpected error occurred while processing your request. Please try again.",
        suggestion: "If the problem persists, please contact support with the error details."
      },
      { status: 500 }
    );
  }
}
