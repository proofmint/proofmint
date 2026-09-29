import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mime from "mime-types";
import prisma from "@/lib/prisma";
import { withX402FromHTTPServer } from "@x402/next";
import { httpServerForRoute } from "@/lib/x402/server";
import { badgeMintRoute } from "@/lib/x402/routes";
import { requireIssuerApiKey } from "@/lib/x402/apiKey";
import {
  corsOptions,
  mintMetaHeaders,
  withSettlementRecording,
} from "@/lib/x402/withSettlement";
import { badgeTotalCost, mintBadgeAsset } from "@/lib/services/badgeMinting";
import { deductCredits, refundCredits } from "@/lib/services/creditManager";
import { TransactionType } from "@prisma/client";
import { getDetailedBalances } from "@/lib/blockchain";
import { cleanString } from "@/lib/utils";
import { isValidEmail } from "@/lib/validators";
import { ALGORAND_NETWORK } from "@/lib/const";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const bodySchema = z
  .object({
    badgeName: z.string().min(1).max(32),
    unitName: z.string().min(1).max(8),
    description: z.string().min(1).max(128),
    badgeType: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().min(1).optional(),
    distributionMethod: z.enum(["email", "magic"]).default("email"),
    recipientEmails: z.array(z.string().min(1)).optional(),
    claimLimit: z.number().int().min(1).optional(),
    properties: z.record(z.string(), z.any()).optional(),
  })
  .refine((b) => b.imageUrl || b.imageBase64, {
    message: "Either imageUrl or imageBase64 is required",
    path: ["imageUrl"],
  })
  .refine(
    (b) => b.distributionMethod !== "email" || (b.recipientEmails?.length ?? 0) > 0,
    { message: "recipientEmails is required for email distribution", path: ["recipientEmails"] }
  )
  .refine((b) => b.distributionMethod !== "magic" || b.claimLimit !== undefined, {
    message: "claimLimit is required for magic distribution",
    path: ["claimLimit"],
  });

/** Fetches or decodes the badge image, enforcing the 5MB cap. */
async function loadImage(
  body: z.infer<typeof bodySchema>
): Promise<{ buffer: Buffer; mimeType: string; ext: string } | { error: string }> {
  let buffer: Buffer;
  let mimeType: string | false = false;

  if (body.imageBase64) {
    const stripped = body.imageBase64.replace(/^data:([^;]+);base64,/, (_m, m1) => {
      mimeType = m1;
      return "";
    });
    buffer = Buffer.from(stripped, "base64");
    if (!buffer.length) return { error: "imageBase64 is not valid base64" };
  } else {
    const res = await fetch(body.imageUrl!);
    if (!res.ok) return { error: `Could not fetch imageUrl (HTTP ${res.status})` };
    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_BYTES) return { error: "Image exceeds 5MB" };
    buffer = Buffer.from(await res.arrayBuffer());
    mimeType = res.headers.get("content-type") || mime.lookup(body.imageUrl!);
  }

  if (buffer.length > MAX_IMAGE_BYTES) return { error: "Image exceeds 5MB" };
  if (!mimeType || !String(mimeType).startsWith("image/")) {
    return { error: "Image must be a valid image content type" };
  }

  const type = String(mimeType).split(";")[0].trim();
  return { buffer, mimeType: type, ext: mime.extension(type) || "bin" };
}

/**
 * Every failure path returns 4xx/5xx on purpose: withX402 settles the USDC
 * payment only when this handler resolves with a status below 400, so a caller
 * is never charged for a badge that was not minted.
 *
 * A badge is one ASA whose supply is the number of awards, matching
 * app/api/badges/create: `count` badges means one asset with `count` units, then
 * either one IssuedBadge row per named recipient or a single claim link with
 * `count` uses.
 */
const handler = async (req: NextRequest) => {
  const auth = await requireIssuerApiKey(req);
  if ("error" in auth) return auth.error;
  const { issuerId, walletAddress, email, creditBalance } = auth.auth;

  const count = countFromQuery(req);

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

  // Deduplicate the way the credit route does: the ASA supply must match the
  // number of distinct recipients, or a badge unit is stranded.
  const recipientEmails =
    body.distributionMethod === "email"
      ? Array.from(new Set((body.recipientEmails ?? []).map(cleanString)))
      : [];

  for (const recipient of recipientEmails) {
    if (!isValidEmail(recipient)) {
      return NextResponse.json(
        { error: `"${recipient}" is not a valid email` },
        { status: 400 }
      );
    }
  }

  // The price was fixed from `count` when the 402 challenge was built, so the
  // body has to match it -- otherwise a caller could pay for one and award many.
  const requested =
    body.distributionMethod === "magic" ? body.claimLimit ?? 0 : recipientEmails.length;
  if (requested !== count) {
    return NextResponse.json(
      {
        error:
          body.distributionMethod === "magic"
            ? "claimLimit must equal the count query parameter"
            : "recipientEmails must hold exactly `count` distinct addresses",
        count,
        requested,
      },
      { status: 400 }
    );
  }

  // The USDC payment is charged in addition to credits, so the issuer must hold
  // one credit per badge before we mint.
  if (creditBalance < count) {
    return NextResponse.json(
      {
        error: `Insufficient credit balance to mint ${count} badge(s)`,
        required: count,
        available: creditBalance,
      },
      { status: 402 }
    );
  }

  const totalCost = badgeTotalCost(count);
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

  const image = await loadImage(body);
  if ("error" in image) {
    return NextResponse.json({ error: image.error }, { status: 400 });
  }

  // Deduct before minting, refund if the chain call fails -- the same ordering
  // app/api/certificates/issue uses.
  const deduction = await deductCredits(issuerId, count, TransactionType.MINT_BADGE);
  if (!deduction.success) {
    return NextResponse.json(
      { error: deduction.error || "Failed to deduct credits" },
      { status: 402 }
    );
  }

  let mintResult;
  try {
    mintResult = await mintBadgeAsset({
      issuerWalletAddress: walletAddress,
      issuerEmail: email,
      badgeName: body.badgeName,
      unitName: body.unitName,
      description: body.description,
      imageBuffer: image.buffer,
      imageMimeType: image.mimeType,
      imageExt: image.ext,
      numToMint: count,
      recipientEmails,
      customProperties: body.properties,
    });
  } catch (error) {
    await refundCredits(issuerId, count, TransactionType.MINT_BADGE);
    console.error("[x402] badge mint failed", error);
    return NextResponse.json(
      {
        error: "Badge minting failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }

  const { badge, claimLinkId } = await prisma.$transaction(async (tx) => {
    const created = await tx.badge.create({
      data: {
        name: body.badgeName,
        assetId: mintResult.assetId,
        issuerId,
        description: body.description,
        imageCid: mintResult.imageCid,
        metadataCid: mintResult.metadataCid,
        unitName: body.unitName,
        badgeType: body.badgeType,
        customProperties: (body.properties ?? {}) as any,
      },
    });

    if (body.distributionMethod === "magic") {
      const link = await tx.badgeClaimLink.create({
        data: { badgeId: created.id, issuerId, limit: count },
      });
      return { badge: created, claimLinkId: link.id };
    }

    await tx.issuedBadge.createMany({
      data: recipientEmails.map((receiverEmail) => ({
        badgeId: created.id,
        receiverEmail,
        issuerId,
        status: "PENDING" as const,
      })),
      skipDuplicates: true,
    });

    return { badge: created, claimLinkId: null as string | null };
  });

  return NextResponse.json(
    {
      badgeId: badge.id,
      assetId: mintResult.assetId,
      txId: mintResult.txId,
      explorerUrl: `https://allo.info/asset/${mintResult.assetId}`,
      imageCid: mintResult.imageCid,
      metadataCid: mintResult.metadataCid,
      network: ALGORAND_NETWORK,
      count,
      distributionMethod: body.distributionMethod,
      recipientEmails,
      claimLinkId,
    },
    {
      status: 200,
      headers: mintMetaHeaders({ issuerId, quantity: count, refId: badge.id }),
    }
  );
};

/** Absent `count` means a single badge; anything else must be a positive integer. */
function countFromQuery(req: NextRequest): number {
  const raw = req.nextUrl.searchParams.get("count");
  return raw === null || raw === "" ? 1 : Number(raw);
}

const paid = withSettlementRecording(
  withX402FromHTTPServer(
    handler,
    httpServerForRoute("POST /api/x402/badges/mint", badgeMintRoute)
  ),
  "BADGE"
);

/**
 * `count` is validated before the payment flow starts. The dynamic price is a
 * function of it, and a price function that throws surfaces as an opaque 500 --
 * so a bad count has to be rejected as a plain 400 here, up front.
 */
export const POST = async (req: NextRequest) => {
  const count = countFromQuery(req);
  if (!Number.isInteger(count) || count < 1) {
    return NextResponse.json(
      { error: "count query parameter must be a positive integer" },
      { status: 400 }
    );
  }
  return paid(req);
};

export const OPTIONS = async () => corsOptions();
