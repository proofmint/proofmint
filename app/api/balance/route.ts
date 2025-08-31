import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";
import prisma from "@/lib/prisma";
import { getDetailedBalances } from "@/lib/blockchain";

export async function GET(req: NextRequest) {
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });

    if (!user || !user.walletAddress) {
      return NextResponse.json({ message: "Wallet address not found" }, { status: 404 });
    }

    const balances = await getDetailedBalances(user.walletAddress);
    
    return NextResponse.json(balances);

  } catch (error) {
    console.error("Failed to fetch balance:", error);
    if (error instanceof Error && error.message.includes("could not be verified")) {
        return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ message: "An unexpected error occurred" }, { status: 500 });
  }
}
