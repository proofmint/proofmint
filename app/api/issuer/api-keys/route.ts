import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireIssuer } from "@/lib/auth";
import { generateApiKey } from "@/lib/x402/apiKey";

const createSchema = z.object({ name: z.string().min(1).max(64) });

export async function GET(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;

  const keys = await prisma.issuerApiKey.findMany({
    where: { issuerId: auth.payload.issuerId! },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A key name is required" }, { status: 400 });
  }

  const { raw, keyHash, prefix } = generateApiKey();
  const created = await prisma.issuerApiKey.create({
    data: {
      issuerId: auth.payload.issuerId!,
      name: parsed.data.name,
      keyHash,
      prefix,
    },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });

  // The raw key is returned exactly once and never stored.
  return NextResponse.json({ ...created, key: raw }, { status: 201 });
}
