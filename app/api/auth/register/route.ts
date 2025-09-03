import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { getWallet } from "@/lib/vault";
import { getHash, cleanString } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const {
      name,
      email: rawEmail,
      password,
      role,
      organizationName,
      websiteUrl,
    } = await req.json();

    const email = cleanString(rawEmail);

    if (!name || !email || !password || !role || !organizationName) {
      return NextResponse.json(
        { message: "Missing required fields." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { message: "User already exists." },
          { status: 400 }
        );
      } else {
        // Resend verification email if the user exists but is not verified
        const token = await prisma.authToken.create({
          data: {
            token: uuidv4(),
            type: "EMAIL_VERIFICATION",
            userId: existingUser.id,
            expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
          },
        });
        await sendVerificationEmail(email, token.token);
        return NextResponse.json(
          { message: "Verification email sent." },
          { status: 200 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const walletAddress = await getWallet(getHash(email));

    if (walletAddress === null) {
      return NextResponse.json(
        { message: "Wallet creation failed." },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        fullName: name,
        email,
        passwordHash: hashedPassword,
        role: role.toUpperCase(),
        walletAddress: walletAddress,
        organizationName: organizationName,
      },
    });

    if (role.toUpperCase() === "ISSUER") {
      await prisma.issuer.create({
        data: {
          userId: user.id,
          websiteUrl: websiteUrl,
          status: "PENDING",
        },
      });
    }

    const token = await prisma.authToken.create({
      data: {
        token: uuidv4(),
        type: "EMAIL_VERIFICATION",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      },
    });

    await sendVerificationEmail(email, token.token);

    return NextResponse.json(
      { message: "Verification email sent." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
