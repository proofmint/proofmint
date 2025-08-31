import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";
import { z } from "zod";

const createJobSchema = z.object({
  templateId: z.string().min(1),
  recipients: z.array(z.object({ email: z.string().email(), fieldData: z.record(z.string(), z.string()).optional().default({}) })).min(1),
});

export async function POST(req: NextRequest) {
  const token = (await cookies()).get("token")?.value;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET), {});
    const userId = (payload as any).userId as string;
    const issuer = await prisma.issuer.findUnique({ where: { userId } });
    if (!issuer) return NextResponse.json({ message: "Issuer not found" }, { status: 404 });

    const body = await req.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const { templateId, recipients } = parsed.data;

    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
    if (!template) return NextResponse.json({ message: "Template not found" }, { status: 404 });

    // Ensure sufficient credits
    if ((issuer.creditBalance ?? 0) < recipients.length) {
      return NextResponse.json({ message: "Insufficient credits for bulk issuance" }, { status: 400 });
    }

    const job = await prisma.bulkIssuanceJob.create({
      data: {
        issuerId: issuer.id,
        certificateTemplateId: templateId,
        recipientData: recipients as unknown as any,
        totalItems: recipients.length,
        status: "PENDING",
      },
    });

    return NextResponse.json({ jobId: job.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}


