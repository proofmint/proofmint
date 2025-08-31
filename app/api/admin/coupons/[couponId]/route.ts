import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { couponId } = await params;
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ coupon });
  } catch (e) {
    return NextResponse.json({ message: "Failed to fetch coupon" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ couponId: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { couponId } = await params;
    const existing = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const updateSchema = z
      .object({
        code: z.string().trim().min(1).optional(),
        discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
        discountValue: z.coerce.number().positive().optional(),
        maxUses: z.coerce.number().int().positive().optional().nullable(),
        expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        isActive: z.boolean().optional(),
        issuerEmail: z.string().email().optional().nullable(),
        minPurchaseAmount: z.coerce.number().positive().optional().nullable(),
      })
      .refine((val) => Object.keys(val).length > 0, { message: "No fields to update" });

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const effectiveType = (data.discountType ?? existing.discountType) as "PERCENTAGE" | "FIXED_AMOUNT";
    if (data.discountValue !== undefined && effectiveType === "PERCENTAGE") {
      if (!(data.discountValue >= 1 && data.discountValue <= 100)) {
        return NextResponse.json(
          { message: "Percentage must be between 1 and 100" },
          { status: 400 }
        );
      }
    }

    // Ensure code uniqueness if code is changing
    if (data.code && data.code !== existing.code) {
      const byCode = await prisma.coupon.findUnique({ where: { code: data.code } });
      if (byCode && byCode.id !== existing.id) {
        return NextResponse.json({ message: "Coupon code already exists" }, { status: 409 });
      }
    }

    // Resolve issuerEmail to issuerId if provided
    let issuerId: string | undefined | null = undefined;
    if (data.issuerEmail !== undefined) {
      if (data.issuerEmail === null) {
        issuerId = null;
      } else {
        const user = await prisma.user.findUnique({ where: { email: data.issuerEmail }, include: { issuerProfile: true } });
        if (!user || user.role !== "ISSUER" || !user.issuerProfile) {
          return NextResponse.json({ message: "Issuer email is invalid" }, { status: 400 });
        }
        issuerId = user.issuerProfile.id;
      }
    }

    const updated = await prisma.coupon.update({
      where: { id: couponId },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
        ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
        ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(issuerId !== undefined ? { issuerId } : {}),
        ...(data.minPurchaseAmount !== undefined ? { minPurchaseAmount: data.minPurchaseAmount } : {}),
      },
    });
    return NextResponse.json({ coupon: updated });
  } catch (e) {
    return NextResponse.json({ message: "Failed to update coupon" }, { status: 500 });
  }
}


