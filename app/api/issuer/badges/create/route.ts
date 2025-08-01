import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { z } from "zod";
import { adminWallet, algodClient, JWT_SECRET, PINATA_JWT } from "@/lib/const";
import { getDetailedBalances } from "@/lib/blockchain";
import mime from "mime-types";
import { calculateSHA256 } from "@/lib/utils";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import { cleanEmail } from "@/lib/utils";

const BADGE_MINT_COST = 0.5; // Cost per NFT in Algos

const uploadToPinata = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const pinataOptions = JSON.stringify({
    cidVersion: 0,
  });
  formData.append("pinataOptions", pinataOptions);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  return res.json();
};

async function uploadJsonToPinata(json: any) {
  try {
    const data = JSON.stringify({
      pinataContent: json,
      pinataMetadata: { name: "metadata.json" },
    });

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      body: data,
      headers: {
        "Content-Type": `application/json`,
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });
    return res.json();
  } catch (error) {
    console.error(`Error uploading JSON to Pinata: ${error}`);
    throw error;
  }
}

async function mintBadgeOnBlockchain(
  metadata: any
): Promise<{ assetId: string }> {
  console.log("Minting badge on blockchain with metadata:", metadata);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const dummyAssetId = `asset_${Date.now()}`;
  return { assetId: dummyAssetId };
}

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

    const recipientEmails = (recipients || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
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

    const totalCost = numToMint * BADGE_MINT_COST;
    const { deltaBalance } = await getDetailedBalances(
      issuer.user.walletAddress
    );

    if (deltaBalance < totalCost) {
      return NextResponse.json(
        { error: "Insufficient balance to mint badges" },
        { status: 400 }
      );
    }

    const pinataResult = await uploadToPinata(imageFile);
    console.log(pinataResult);

    const mimeType = mime.lookup(imageFile.name);
    if (!mimeType) {
      return NextResponse.json(
        { error: "Invalid image file" },
        { status: 400 }
      );
    }

    const imageHash = await calculateSHA256(await imageFile.arrayBuffer());

    const metadata = {
      name: badgeName,
      unit_name: unitName,
      creator: issuer.user.walletAddress,
      image: `ipfs://${pinataResult.IpfsHash}#arc3`,
      image_integrity: `sha256-${imageHash}`,
      image_mimetype: mimeType,
      properties: customProperties,
    };

    const metadataCid = await uploadJsonToPinata(metadata);

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
        }),
        signerEmail: issuer.user.email,
        signerAddress: issuer.user.walletAddress,
      },
      {
        txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: issuer.user.walletAddress,
          receiver: adminWallet.addr.toString(),
          amount: algosdk.algosToMicroalgos(totalCost - 0.102),
          suggestedParams,
        }),
        signerEmail: issuer.user.email,
        signerAddress: issuer.user.walletAddress,
      },
    ];

    const bytes = await signTransactions(group);

    const txnResult = await algodClient.sendRawTransaction(bytes).do();

    const blockchainResult = await algodClient
      .pendingTransactionInformation(txnResult.txid)
      .do();
    const newBadge = await prisma.badge.create({
      data: {
        name: badgeName,
        assetId: blockchainResult.assetIndex?.toString() || "",
        issuerId: issuer.id,
        description,
        imageUrl: `https://ipfs.io/ipfs/${pinataResult.IpfsHash}`,
        unitName,
        badgeType,
        customProperties: customProperties as any,
      },
    });

    if (distributionMethod === "magic") {
      await prisma.badgeClaimLink.create({
        data: {
          badgeId: newBadge.id,
          issuerId: issuer.id,
          limit: numToMint,
        },
      });
    } else {
      const issueTasks = recipientEmails
        .map((email) => {
          return prisma.issuedBadge.create({
            data: {
              badgeId: newBadge.id,
              receiverEmail: cleanEmail(email),
              issuerId: issuer.id,
              status: "pending",
            },
          });
        })
        .filter(Boolean);
      await Promise.all(issueTasks);
    }

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
