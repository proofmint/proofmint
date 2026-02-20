import { NextRequest, NextResponse } from "next/server";
import { requireIssuer } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateCertificate } from "@/lib/services/imageGenerator";

/**
 * POST /api/certificates/preview
 *
 * Generates a certificate preview image without issuing or deducting credits.
 * Returns the PNG image directly.
 */
export async function POST(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) {
    return auth.error;
  }

  const { payload } = auth;
  const issuerId = payload.issuerId!;

  try {
    const body = await req.json();
    const { templateId, fieldData } = body;

    if (!templateId || typeof templateId !== "string") {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (template.issuerId !== issuerId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const safeFieldData: Record<string, string> = {};
    if (fieldData && typeof fieldData === "object") {
      for (const [k, v] of Object.entries(fieldData)) {
        safeFieldData[k] = typeof v === "string" ? v : String(v);
      }
    }

    const imageBuffer = await generateCertificate(templateId, safeFieldData);

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Preview] Error generating preview:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
