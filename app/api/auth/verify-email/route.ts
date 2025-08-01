import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { message: "Token is required." },
        { status: 400 }
      );
    }

    const verificationToken = await prisma.authToken.findUnique({
      where: { token, type: "EMAIL_VERIFICATION" },
      include: { user: true },
    });

    if (!verificationToken || verificationToken.expiresAt < new Date()) {
      return NextResponse.json(
        { message: "Invalid or expired token." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    await prisma.authToken.delete({
      where: { id: verificationToken.id },
    });

    return NextResponse.json(
      { message: "Email verified successfully." },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
