import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { z } from "zod";
import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;
    const role = (payload as any).role as string;

    if (role === "ISSUER") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          issuerProfile: true,
        },
      });

      if (!user || !user.issuerProfile) {
        return NextResponse.json(
          { message: "Issuer not found" },
          { status: 401 }
        );
      }

      return NextResponse.json({
        fullName: user.fullName,
        email: user.email,
        organizationName: user.organizationName,
        websiteUrl: user.issuerProfile.websiteUrl,
        walletAddress: user.walletAddress,
        credits: user.issuerProfile.creditBalance,
        status: user.issuerProfile.status,
        memberSince: user.createdAt,
      });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return NextResponse.json(
          { message: "User not found" },
          { status: 401 }
        );
      }

      return NextResponse.json({
        fullName: user.fullName,
        email: user.email,
        organizationName: user.organizationName,
        walletAddress: user.walletAddress,
        memberSince: user.createdAt,
      });
    }
  } catch (error) {
    console.error("Profile fetch failed:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

const issuerProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  websiteUrl: z.string().url("Invalid URL format").optional().or(z.literal("")),
});

const receiverProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
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
    const role = (payload as any).role as string;

    if (!userId) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    const body = await req.json();

    if (role === "ISSUER") {
      const validation = issuerProfileSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { errors: validation.error.format() },
          { status: 400 }
        );
      }

      const { fullName, organizationName, websiteUrl } = validation.data;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { fullName, organizationName },
        });

        await tx.issuer.update({
          where: { userId },
          data: { websiteUrl: websiteUrl || null },
        });
      });
    } else {
      const validation = receiverProfileSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { errors: validation.error.format() },
          { status: 400 }
        );
      }

      const { fullName, organizationName } = validation.data;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { fullName, organizationName },
        });
      });
    }

    return NextResponse.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Profile update failed:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
