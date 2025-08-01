import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";

const secret = new TextEncoder().encode(JWT_SECRET);

export async function GET(req: NextRequest) {
  const token = (await cookies()).get("token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    const user = {
      id: (payload as any).userId,
      email: (payload as any).email,
      fullName: (payload as any).fullName,
      role: (payload as any).role,
      issuerId: (payload as any).issuerId,
    };

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid token" },
      { status: 401 }
    );
  }
}
