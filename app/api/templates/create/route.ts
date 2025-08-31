import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/const";

export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      templateName,
      templateDescription,
      backgroundImageUrl,
      dynamicFields,
    } = body;

    // Validate required fields
    if (!templateName || !templateDescription || !backgroundImageUrl) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the template
    const template = await prisma.certificateTemplate.create({
      data: {
        issuerId: issuerId,
        templateName,
        templateDescription,
        backgroundImageUrl,
        dynamicFields: dynamicFields || [],
      },
    });

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
