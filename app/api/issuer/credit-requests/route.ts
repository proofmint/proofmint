import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireIssuer } from "@/lib/auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;
  try {
    const requests = await prisma.creditPurchaseRequest.findMany({
      where: { issuerId: auth.payload.issuerId! },
      orderBy: { createdAt: "desc" },
    });
    const rows = requests.map((r) => ({
      id: r.id,
      creditsRequested: r.creditsRequested,
      amountPaid: String(r.amountPaid),
      paymentProofUrl: r.paymentProofBase64,
      referenceNumber: r.referenceNumber,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return NextResponse.json({ requests: rows });
  } catch (e) {
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}

const schema = z.object({
  creditsRequested: z.coerce.number().int().positive(),
  amountPaid: z.coerce.number().positive(),
  paymentProofBase64: z.string().trim().min(1).optional().nullable(),
  referenceNumber: z.string().trim().min(1),
  couponCode: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const auth = await requireIssuer(req);
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const { creditsRequested, amountPaid, paymentProofBase64, referenceNumber, couponCode } = parsed.data;

    let couponId: string | null = null;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
        return NextResponse.json({ message: "Invalid coupon" }, { status: 400 });
      }
      if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
        return NextResponse.json({ message: "Coupon usage limit reached" }, { status: 400 });
      }
      couponId = coupon.id;
    }

    const created = await prisma.creditPurchaseRequest.create({
      data: {
        issuerId: auth.payload.issuerId!,
        creditsRequested,
        amountPaid,
        paymentProofBase64: paymentProofBase64 ?? "",
        referenceNumber,
        status: "PENDING",
      },
    });

    if (couponId) {
      await prisma.couponUsage.create({
        data: { couponId, purchaseRequestId: created.id, issuerId: auth.payload.issuerId! },
      });
      await prisma.coupon.update({ where: { id: couponId }, data: { uses: { increment: 1 } } });
    }

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}


