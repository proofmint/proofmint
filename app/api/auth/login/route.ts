import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { JWT_SECRET } from "@/lib/const";
import { Prisma } from "@prisma/client";
import { cleanEmail } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { loginType, ...payload } = await req.json();

    let user: Prisma.UserGetPayload<{
      include: { issuerProfile: true };
    }> | null = null;

    if (loginType === "otp") {
      const { email: rawEmail, otp } = payload;

      const email = cleanEmail(rawEmail);

      if (!email || !otp) {
        return NextResponse.json(
          { message: "Email and OTP are required." },
          { status: 400 }
        );
      }

      const otpToken = await prisma.authToken.findFirst({
        where: {
          user: { email },
          token: otp,
          type: "OTP",
          expiresAt: { gt: new Date() },
        },
        include: { user: { include: { issuerProfile: true } } },
      });

      if (!otpToken) {
        return NextResponse.json(
          { message: "Invalid or expired OTP." },
          { status: 400 }
        );
      }

      user = otpToken.user;
      await prisma.authToken.delete({ where: { id: otpToken.id } });

      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
        user.emailVerified = true;
      }
    } else if (loginType === "magic-link") {
      const { token: magicToken } = payload;
      if (!magicToken) {
        return NextResponse.json(
          { message: "Magic token is required." },
          { status: 400 }
        );
      }

      const dbToken = await prisma.authToken.findFirst({
        where: {
          token: magicToken,
          type: "MAGIC_LINK",
          expiresAt: { gt: new Date() },
        },
        include: { user: { include: { issuerProfile: true } } },
      });

      if (!dbToken) {
        return NextResponse.json(
          { message: "Invalid or expired magic link." },
          { status: 400 }
        );
      }

      user = dbToken.user;
      await prisma.authToken.delete({ where: { id: dbToken.id } });

      if (!user.emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
        user.emailVerified = true;
      }
    } else {
      const { email: rawEmail, password } = payload;

      const email = cleanEmail(rawEmail);

      if (!email || !password) {
        return NextResponse.json(
          { message: "Email and password are required." },
          { status: 400 }
        );
      }
      const foundUser = await prisma.user.findUnique({
        where: { email },
        include: { issuerProfile: true },
      });

      if (!foundUser || !foundUser.passwordHash) {
        return NextResponse.json(
          { message: "Invalid credentials." },
          { status: 401 }
        );
      }

      if (!foundUser.emailVerified) {
        return NextResponse.json(
          {
            message:
              "Please verify your email before logging in or login with magic link.",
          },
          { status: 403 }
        );
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        foundUser.passwordHash
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { message: "Invalid credentials." },
          { status: 401 }
        );
      }
      user = foundUser;
    }

    if (!user) {
      return NextResponse.json(
        { message: "Could not authenticate user." },
        { status: 500 }
      );
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      issuerId: user.issuerProfile?.id,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "1d",
    });

    (await cookies()).set("token", token, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
