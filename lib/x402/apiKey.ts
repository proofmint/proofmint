import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getHash } from "@/lib/utils";
import { requireIssuer } from "@/lib/auth";

export const API_KEY_HEADER = "x-issuer-key";
const API_KEY_PREFIX = "pmk_";

export interface ApiKeyAuth {
  issuerId: string;
  walletAddress: string;
  email: string;
  organizationName: string;
  creditBalance: number;
  apiKeyId: string;
}

/** Generates a new raw key. Shown to the issuer once; only its hash is stored. */
export function generateApiKey(): { raw: string; keyHash: string; prefix: string } {
  const raw = API_KEY_PREFIX + crypto.randomBytes(32).toString("base64url");
  return { raw, keyHash: getHash(raw), prefix: raw.slice(0, 12) };
}

/**
 * Authenticates a request by issuer API key.
 *
 * Mirrors the `{ payload } | { error }` shape of requireIssuer in lib/auth.ts so
 * callers can keep using `if ("error" in auth) return auth.error`.
 */
export async function requireIssuerApiKey(
  req: NextRequest
): Promise<{ auth: ApiKeyAuth } | { error: NextResponse }> {
  const raw = req.headers.get(API_KEY_HEADER);
  if (!raw) {
    // No key: fall back to the dashboard session, so the issuer's own UI can
    // drive the same paid endpoints without minting a key and shipping it to
    // the browser. The x402 payment is verified before this runs either way.
    return sessionAuth(req);
  }

  const record = await prisma.issuerApiKey.findUnique({
    where: { keyHash: getHash(raw) },
    include: {
      issuer: {
        include: {
          user: {
            select: { walletAddress: true, email: true, organizationName: true },
          },
        },
      },
    },
  });

  if (!record || record.revokedAt) {
    return {
      error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
    };
  }

  if (record.issuer.status !== "APPROVED") {
    return {
      error: NextResponse.json(
        { error: "Issuer account is not approved" },
        { status: 403 }
      ),
    };
  }

  if (!record.issuer.user.walletAddress) {
    return {
      error: NextResponse.json(
        { error: "Issuer has no wallet address" },
        { status: 403 }
      ),
    };
  }

  // Best-effort; a failed timestamp update must not fail the request.
  prisma.issuerApiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch((e) => console.error("[x402] failed to stamp API key lastUsedAt", e));

  return {
    auth: {
      issuerId: record.issuerId,
      walletAddress: record.issuer.user.walletAddress,
      email: record.issuer.user.email,
      organizationName: record.issuer.user.organizationName,
      creditBalance: record.issuer.creditBalance,
      apiKeyId: record.id,
    },
  };
}

/**
 * Cookie-session equivalent of an API key, for calls from the issuer dashboard.
 */
async function sessionAuth(
  req: NextRequest
): Promise<{ auth: ApiKeyAuth } | { error: NextResponse }> {
  const session = await requireIssuer(req);
  if ("error" in session) {
    return {
      error: NextResponse.json(
        { error: `Missing ${API_KEY_HEADER} header and no issuer session` },
        { status: 401 }
      ),
    };
  }

  const issuer = await prisma.issuer.findUnique({
    where: { id: session.payload.issuerId! },
    include: {
      user: {
        select: { walletAddress: true, email: true, organizationName: true },
      },
    },
  });

  if (!issuer) {
    return { error: NextResponse.json({ error: "Issuer not found" }, { status: 401 }) };
  }
  if (issuer.status !== "APPROVED") {
    return {
      error: NextResponse.json(
        { error: "Issuer account is not approved" },
        { status: 403 }
      ),
    };
  }
  if (!issuer.user.walletAddress) {
    return {
      error: NextResponse.json(
        { error: "Issuer has no wallet address" },
        { status: 403 }
      ),
    };
  }

  return {
    auth: {
      issuerId: issuer.id,
      walletAddress: issuer.user.walletAddress,
      email: issuer.user.email,
      organizationName: issuer.user.organizationName,
      creditBalance: issuer.creditBalance,
      apiKeyId: "session",
    },
  };
}
