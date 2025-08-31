import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, JWTPayload } from "jose";
import { JWT_SECRET } from "@/lib/const";

const secret = new TextEncoder().encode(JWT_SECRET);

export interface AuthPayload extends JWTPayload {
  userId: string;
  email: string;
  fullName: string;
  role: "ISSUER" | "RECEIVER" | "ADMIN";
  issuerId?: string | null;
}

export async function requireAdmin(req: NextRequest): Promise<{ payload: AuthPayload } | { error: NextResponse }> {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  try {
    const { payload } = await jwtVerify(token, secret);
    const auth = payload as AuthPayload;
    if (auth.role !== "ADMIN") {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
    return { payload: auth };
  } catch (e) {
    return { error: NextResponse.json({ message: "Invalid token" }, { status: 401 }) };
  }
}

export async function requireIssuer(req: NextRequest): Promise<{ payload: AuthPayload } | { error: NextResponse }> {
  const token = (await cookies()).get("token")?.value;
  if (!token) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  try {
    const { payload } = await jwtVerify(token, secret);
    const auth = payload as AuthPayload;
    if (auth.role !== "ISSUER" || !auth.issuerId) {
      return { error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) };
    }
    return { payload: auth };
  } catch (e) {
    return { error: NextResponse.json({ message: "Invalid token" }, { status: 401 }) };
  }
}


