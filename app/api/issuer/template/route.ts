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
    const userId = (payload as any).userId as string;

    // Verify the issuer exists and is authorized
    const issuer = await prisma.issuer.findUnique({
      where: { userId },
    });

    if (!issuer) {
      return NextResponse.json(
        { error: "Issuer not found or unauthorized" },
        { status: 403 }
      );
    }

    const templates = await prisma.certificateTemplate.findMany({
      where: { issuerId: issuer.id },
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

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;

    // Verify the issuer exists and is authorized
    const issuer = await prisma.issuer.findUnique({
      where: { userId },
    });

    if (!issuer) {
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
        issuerId: issuer.id,
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

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).userId as string;

    // Verify the issuer exists and is authorized
    const issuer = await prisma.issuer.findUnique({
      where: { userId },
    });

    if (!issuer) {
      return NextResponse.json(
        { error: "Issuer not found or unauthorized" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      id,
      templateName,
      templateDescription,
      backgroundImageUrl,
      dynamicFields,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const template = await prisma.certificateTemplate.findUnique({
      where: {
        id,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    if (template.issuerId !== issuer.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updatedTemplate = await prisma.certificateTemplate.update({
      where: { id },
      data: {
        templateName,
        templateDescription,
        backgroundImageUrl,
        dynamicFields: dynamicFields || [],
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedTemplate, { status: 200 });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}
