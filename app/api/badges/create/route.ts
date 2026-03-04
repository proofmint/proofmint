import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { z } from "zod";
import { algodClient, JWT_SECRET, OPERATIONAL_WALLET } from "@/lib/const";
import { getDetailedBalances } from "@/lib/blockchain";
import mime from "mime-types";
import { calculateSHA256, getEmailsHash } from "@/lib/utils";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import { cleanString } from "@/lib/utils";
import { uploadImageToStoracha, uploadJsonToStoracha } from "@/lib/storacha";
import { BADGES_PATH } from "@/lib/uploads";
import fs from "fs/promises";
import path from "path";
import { isValidEmail } from "@/lib/validators";

const createBadgeSchema = z.object({
  badgeName: z
    .string()
    .min(1, "Badge name is required")
    .max(32, "Badge name must be less than 32 characters"),
  unitName: z
    .string()
    .min(1, "Unit name is required")
    .max(8, "Unit name must be less than 8 characters"),
  badgeType: z.string().min(1, "Badge type is required"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(128, "Description must be less than 128 characters"),
  customProperties: z.array(
    z.object({
      key: z
        .string()
        .min(1, "Key is required")
        .max(32, "Key must be less than 32 characters"),
      value: z
        .string()
        .min(1, "Value is required")
        .max(128, "Value must be less than 128 characters"),
    })
  ),
  distributionMethod: z.enum(["email", "magic"]),
  recipients: z.string().optional(),
  claimLimit: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;

    const issuer = await prisma.issuer.findUnique({
      where: { userId },
      include: { user: { select: { walletAddress: true, email: true } } },
    });

    if (!issuer || !issuer.user.walletAddress) {
      return NextResponse.json(
        { error: "Issuer or wallet not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const rawData = Object.fromEntries(formData);

    // Manually parse customProperties before validation
    const parsedData = {
      ...rawData,
      customProperties: JSON.parse(
        (rawData.customProperties as string) || "[]"
      ),
    };

    const validation = createBadgeSchema.safeParse(parsedData);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 }
      );
    }

    const {
      badgeName,
      unitName,
      badgeType,
      description,
      customProperties,
      distributionMethod,
      recipients,
      claimLimit,
    } = validation.data;

    const imageFile = formData.get("image") as File;
    if (!imageFile || imageFile.size > 5 * 1024 * 1024) {
      // 5MB validation
      return NextResponse.json(
        { error: "Badge image is required and must be under 5MB" },
        { status: 400 }
      );
    }

    const formattedRecipients = (recipients || "")
      .split(",")
      .map(cleanString)
      .filter(Boolean);

    if (distributionMethod === "email") {
      const invalidRecipients = formattedRecipients.filter((e) => !isValidEmail(e));
      if (invalidRecipients.length > 0) {
        return NextResponse.json(
          { error: `Invalid recipient emails: ${invalidRecipients.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const recipientEmailsSet = new Set(formattedRecipients.filter(isValidEmail));
    const recipientEmails = Array.from(recipientEmailsSet);

    const numToMint =
      distributionMethod === "magic"
        ? parseInt(claimLimit || "0", 10)
        : recipientEmails.length;

    if (numToMint === 0) {
      return NextResponse.json(
        { error: "No recipients or claims specified" },
        { status: 400 }
      );
    }

    if (issuer.creditBalance < numToMint) {
      return NextResponse.json(
        { error: "Insufficient credit balance to mint badges" },
        { status: 400 }
      );
    }

    const totalCost = 0.102 + numToMint * 0.103;
    const { deltaBalance } = await getDetailedBalances(
      issuer.user.walletAddress
    );

    if (deltaBalance < totalCost) {
      return NextResponse.json(
        { error: "Insufficient algo balance to mint badges" },
        { status: 400 }
      );
    }

    const mimeType = mime.lookup(imageFile.name);
    if (!mimeType) {
      return NextResponse.json(
        { error: "Invalid image file" },
        { status: 400 }
      );
    }

    const uploadResult = await uploadImageToStoracha(imageFile);

    if(!uploadResult || !uploadResult.IpfsHash) {
      return NextResponse.json(
        { error: "Failed to upload image to IPFS, please try again" },
        { status: 500 }
      );
    }

    // Save local copy with correct extension
    const ext = mime.extension(mimeType) || "bin";
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    await fs.writeFile(path.join(BADGES_PATH, `${uploadResult.IpfsHash}.${ext}`), imageBuffer);

    const imageHash = await calculateSHA256(await imageFile.arrayBuffer());

    const emailsHash = await getEmailsHash(recipientEmails);

    const metadata = {
      name: badgeName,
      unit_name: unitName,
      creator: issuer.user.walletAddress,
      description,
      image: `ipfs://${uploadResult.IpfsHash}#arc3`,
      image_integrity: `sha256-${imageHash}`,
      image_mimetype: mimeType,
      properties: customProperties,
    };

    const metadataCid = await uploadJsonToStoracha(metadata);

    if(!metadataCid || !metadataCid.IpfsHash) {
      return NextResponse.json(
        { error: "Failed to upload metadata to IPFS, please try again" },
        { status: 500 }
      );
    }

    const suggestedParams = await algodClient.getTransactionParams().do();
    const group = [
      {
        txn: algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: issuer.user.walletAddress,
          total: numToMint,
          decimals: 0,
          assetName: badgeName,
          unitName: unitName,
          assetURL: `ipfs://${metadataCid.IpfsHash}#arc3`,
          defaultFrozen: false,
          manager: issuer.user.walletAddress,
          reserve: issuer.user.walletAddress,
          freeze: issuer.user.walletAddress,
          clawback: issuer.user.walletAddress,
          suggestedParams,
          note: new TextEncoder().encode(
            `badge-${recipientEmails.length > 0 ? emailsHash : ""}`
          ),
        }),
        signerEmail: issuer.user.email,
        signerAddress: issuer.user.walletAddress,
      },
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: issuer.user.walletAddress,
          receiver: OPERATIONAL_WALLET,
          amount: algosdk.algosToMicroalgos(totalCost - 0.102),
          suggestedParams,
        }),
        signerEmail: issuer.user.email,
        signerAddress: issuer.user.walletAddress,
      },
    ];

    const { bytes, txnIds } = await signTransactions(group);

    await algodClient.sendRawTransaction(bytes).do();

    const blockchainResult = await algosdk.waitForConfirmation(
      algodClient,
      txnIds[0],
      3
    );

    const { newBadge } = await prisma.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          issuerId: issuer.id,
          type: "MINT_BADGE",
          amount: numToMint,
        },
      });

      await tx.issuer.update({
        where: { id: issuer.id },
        data: { creditBalance: { decrement: numToMint } },
      });

      const createdBadge = await tx.badge.create({
        data: {
          name: badgeName,
          assetId: blockchainResult.assetIndex?.toString() || "",
          issuerId: issuer.id,
          description,
          imageCid: uploadResult.IpfsHash,
          metadataCid: metadataCid.IpfsHash,
          unitName,
          badgeType,
          customProperties: customProperties as any,
        },
      });

      if (distributionMethod === "magic") {
        await tx.badgeClaimLink.create({
          data: {
            badgeId: createdBadge.id,
            issuerId: issuer.id,
            limit: numToMint,
          },
        });
      } else if (recipientEmails.length > 0) {
        await tx.issuedBadge.createMany({
          data: recipientEmails.map((email) => ({
            badgeId: createdBadge.id,
            receiverEmail: cleanString(email),
            issuerId: issuer.id,
            status: "PENDING",
          })),
          skipDuplicates: true,
        });
      }

      return { newBadge: createdBadge };
    });

    return NextResponse.json(
      {
        message: "Badge created successfully",
        badge: newBadge,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating badge:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.format() }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
