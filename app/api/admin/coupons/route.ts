import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ coupons });
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch coupons" }, { status: 500 });
  }
}

const createCouponSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.coerce.number().positive("Must be greater than 0"),
  maxUses: z.coerce.number().int().positive().optional().nullable(),
  // Accept yyyy-mm-dd from <input type="date">
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
  issuerEmail: z.string().email().optional().nullable(),
  minPurchaseAmount: z.coerce.number().positive().optional().nullable(),
}).superRefine((val, ctx) => {
  if (val.discountType === "PERCENTAGE") {
    if (!(val.discountValue >= 1 && val.discountValue <= 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage must be between 1 and 100",
      });
    }
  }
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const parsed = createCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { code, discountType, discountValue, maxUses, expiresAt, isActive, issuerEmail, minPurchaseAmount } = parsed.data;

    // Ensure code uniqueness
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ message: "Coupon code already exists" }, { status: 409 });
    }

    // Map issuerEmail -> issuerId (Issuer.id) if provided
    let issuerId: string | null = null;
    if (issuerEmail) {
      const user = await prisma.user.findUnique({ where: { email: issuerEmail }, include: { issuerProfile: true } });
      if (!user || user.role !== "ISSUER" || !user.issuerProfile) {
        return NextResponse.json({ message: "Issuer email is invalid" }, { status: 400 });
      }
      issuerId = user.issuerProfile.id;
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType,
        // Prisma Decimal expects string | number; number is acceptable
        discountValue,
        maxUses: maxUses ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: typeof isActive === "boolean" ? isActive : true,
        issuerId,
        minPurchaseAmount: minPurchaseAmount ?? null,
      },
    });
    return NextResponse.json({ id: coupon.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ message: "Failed to create coupon" }, { status: 500 });
  }
}


