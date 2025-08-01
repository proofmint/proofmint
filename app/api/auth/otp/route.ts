import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";
import { randomInt } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { message: "Email is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    const otp = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.authToken.create({
      data: {
        token: otp,
        type: "OTP",
        userId: user.id,
        expiresAt,
      },
    });

    await sendOtpEmail(email, otp);

    return NextResponse.json({ message: "OTP sent." }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
