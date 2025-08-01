import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { z } from "zod";
import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";

const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  websiteUrl: z.string().url("Invalid URL format").optional().or(z.literal('')),
});

export async function PUT(req: NextRequest) {
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;

    if (!userId) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    const body = await req.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const { fullName, organizationName, websiteUrl } = validation.data;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { fullName },
      });

      await tx.issuer.update({
        where: { userId },
        data: { organizationName, websiteUrl: websiteUrl || null },
      });
    });

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Profile update failed:", error);
    return NextResponse.json({ message: "An unexpected error occurred" }, { status: 500 });
  }
}
