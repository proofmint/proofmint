import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const row = await prisma.creditPrice.findFirst();
    const qr = (row as any)?.upiQrBase64 ?? null;
    return NextResponse.json({
      value: row ? row.value : null,
      upiQrBase64: qr,
    });
  } catch (e) {
    return NextResponse.json(
      { message: "Failed to fetch credit price" },
      { status: 500 }
    );
  }
}

const updateSchema = z.object({
  value: z.coerce.number().positive(),
  upiQrBase64: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation failed", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { value, upiQrBase64 } = parsed.data;

    const existing = await prisma.creditPrice.findFirst();
    if (!existing) {
      const created = await (prisma.creditPrice as any).create({
        data: { value, upiQrBase64: upiQrBase64 ?? null },
      });
      return NextResponse.json({
        value: created.value,
        upiQrBase64: (created as any)?.upiQrBase64 ?? null,
      });
    } else {
      const updated = await (prisma.creditPrice as any).update({
        where: { id: existing.id },
        data: { value, upiQrBase64: upiQrBase64 ?? null },
      });
      return NextResponse.json({
        value: updated.value,
        upiQrBase64: (updated as any)?.upiQrBase64 ?? null,
      });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Failed to update credit price" },
      { status: 500 }
    );
  }
}
