import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { adminWallet, algodClient, JWT_SECRET, PINATA_JWT } from "@/lib/const";
import { getDetailedBalances } from "@/lib/blockchain";
import mime from "mime-types";
import { calculateSHA256 } from "@/lib/utils";
import algosdk from "algosdk";
import { signTransactions } from "@/lib/vault";
import { cleanEmail } from "@/lib/utils";

const CERTIFICATE_MINT_COST = 0.5; // Cost per NFT in Algos

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

    if (deltaBalance < CERTIFICATE_MINT_COST) {
      return NextResponse.json(
        { error: "Insufficient balance to mint certificate" },
        { status: 400 }
      );
    }

    const pinataResult = await uploadToPinata(imageFile);

    const mimeType = mime.lookup(imageFile.name);
    if (!mimeType) {
      return NextResponse.json(
        { error: "Invalid image file" },
        { status: 400 }
      );
    }

    const imageHash = await calculateSHA256(await imageFile.arrayBuffer());

    const metadata = {
      name: "Certificate",
      unit_name: "CERT",
      creator: issuer.user.walletAddress,
      image: `ipfs://${pinataResult.IpfsHash}#arc3`,
      image_integrity: `sha256-${imageHash}`,
      image_mimetype: mimeType,
      properties: properties,
    };

    const metadataCid = await uploadJsonToPinata(metadata);

    const suggestedParams = await algodClient.getTransactionParams().do();
    const group = [
      {
        txn: algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
          sender: issuer.user.walletAddress,
          total: 1,
          decimals: 0,
          assetName: "Certificate",
          unitName: "CERT",
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
          amount: algosdk.algosToMicroalgos(CERTIFICATE_MINT_COST - 0.102),
          suggestedParams,
        }),
        signerEmail: issuer.user.email,
        signerAddress: issuer.user.walletAddress,
      },
    ];

    const { bytes, txnIds } = await signTransactions(group);

    await algodClient.sendRawTransaction(bytes).do();

    const blockchainResult = await algodClient
      .pendingTransactionInformation(txnIds[0])
      .do();

    const newCertificate = await prisma.issuedCertificate.create({
      data: {
        assetId: blockchainResult.assetIndex?.toString() || "",
        templateId: templateId as string,
        receiverEmail: cleanEmail(recipientEmail as string),
        issuerId: issuer.id,
        fieldData: properties,
        generatedImageUrl: `https://ipfs.io/ipfs/${pinataResult.IpfsHash}`,
        status: "pending",
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
