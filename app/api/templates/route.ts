import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/const";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const issuerId = (payload as any).issuerId as string | undefined;

    if (!issuerId) {
      return NextResponse.json(
        { error: "Issuer not found or unauthorized" },
        { status: 403 }
      );
    }

    const templates = await prisma.certificateTemplate.findMany({
      where: { issuerId: issuerId },
    });

    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}