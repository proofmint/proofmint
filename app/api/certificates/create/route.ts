import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { OPERATIONAL_WALLET, algodClient, JWT_SECRET } from "@/lib/const";
import { getDetailedBalances } from "@/lib/blockchain";
import mime from "mime-types";
import { calculateSHA256 } from "@/lib/utils";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import { cleanString } from "@/lib/utils";
import { storeAsCAR } from "@/lib/car";
import { CERTIFICATES_PATH } from "@/lib/uploads";
import fs from "fs/promises";
import pathModule from "path";

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

    if (!rawData.templateId || !rawData.recipientEmail) {
      return NextResponse.json(
        { error: "Recipient email is required" },
        { status: 400 }
      );
    }

    const { templateId, recipientEmail } = rawData;
    const properties = JSON.parse((rawData.properties as string) || "[]");

    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId as string },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const imageFile = formData.get("certificateImage") as File;
    if (!imageFile || imageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Certificate image is required and must be under 5MB" },
        { status: 400 }
      );
    }

    const { deltaBalance } = await getDetailedBalances(
      issuer.user.walletAddress
    );

    if (issuer.creditBalance < 1) {
      return NextResponse.json(
        { error: "Insufficient credit balance to mint certificate" },
        { status: 400 }
      );
    }

    const totalCost = 0.102 + 0.103;

    if (deltaBalance < totalCost) {
      return NextResponse.json(
        { error: "Insufficient balance to mint certificate" },
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

    const ext = mime.extension(mimeType) || "bin";
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const imageCid = await storeAsCAR(new Uint8Array(imageBuffer));

    // Save local copy with correct extension
    await fs.writeFile(pathModule.join(CERTIFICATES_PATH, `${imageCid}.${ext}`), imageBuffer);

    const imageHash = await calculateSHA256(imageBuffer.buffer as ArrayBuffer);

    const metadata = {
      name: "Certificate",
      unit_name: "CERT",
      creator: issuer.user.walletAddress,
      image: `ipfs://${imageCid}#arc3`,
      image_integrity: `sha256-${imageHash}`,
      image_mimetype: mimeType,
      properties: properties,
    };

    const metadataCid = await storeAsCAR(new TextEncoder().encode(JSON.stringify(metadata)));

    const suggestedParams = await algodClient.getTransactionParams().do();
    const group = [
      {
        txn: algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: issuer.user.walletAddress,
          total: 1,
          decimals: 0,
          assetName: "Certificate",
          unitName: "CERT",
          assetURL: `ipfs://${metadataCid}#arc3`,
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

    const newCertificate = await prisma.issuedCertificate.create({
      data: {
        assetId: blockchainResult.assetIndex?.toString(),
        templateId: templateId as string,
        receiverEmail: cleanString(recipientEmail as string),
        issuerId: issuer.id,
        properties: properties,
        certificateName: (recipientEmail as string) || "Certificate",
        unitName: "CERT",
        description: "Certificate",
        imageCid: imageCid,
        status: "PENDING",
      },
    });

    return NextResponse.json(
      {
        message: "Certificate created successfully",
        certificate: newCertificate,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating certificate:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
