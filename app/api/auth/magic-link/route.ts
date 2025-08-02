import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendMagicLinkEmail } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { getRequestOrigin } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const origin = getRequestOrigin(req);
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { message: "Email is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const token = await prisma.authToken.create({
      data: {
        token: uuidv4(),
        type: "MAGIC_LINK",
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    await sendMagicLinkEmail(origin, email, token.token);

    return NextResponse.json({ message: "Magic link sent." }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
