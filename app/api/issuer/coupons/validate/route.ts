import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireIssuer } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  code: z.string().trim().min(1),
  credits: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
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
    const { code, amount } = parsed.data;

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt < new Date())) {
      return NextResponse.json({ message: "Invalid coupon" }, { status: 400 });
    }
    if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
      return NextResponse.json({ message: "Coupon usage limit reached" }, { status: 400 });
    }
    if (coupon.minPurchaseAmount && amount < Number(coupon.minPurchaseAmount)) {
      return NextResponse.json({ message: "Amount below minimum" }, { status: 400 });
    }

    let discountAmount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = Math.round((Number(coupon.discountValue) / 100) * amount * 100) / 100;
    } else {
      discountAmount = Number(coupon.discountValue);
    }
    const finalAmount = Math.max(0, Math.round((amount - discountAmount) * 100) / 100);

    return NextResponse.json({ discountAmount, finalAmount });
  } catch (e) {
    return NextResponse.json({ message: "Failed" }, { status: 500 });
  }
}


