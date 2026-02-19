import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { message: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Find the token
    const resetToken = await prisma.authToken.findFirst({
      where: {
        token,
        type: "PASSWORD_RESET",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!resetToken) {
      return NextResponse.json(
        { message: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user's password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Delete the used token
    await prisma.authToken.delete({
      where: { id: resetToken.id },
    });

    // Optionally delete all other password reset tokens for this user
    await prisma.authToken.deleteMany({
      where: {
        userId: resetToken.userId,
        type: "PASSWORD_RESET",
      },
    });

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
