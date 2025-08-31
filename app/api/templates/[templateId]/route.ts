import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { JWT_SECRET } from "@/lib/const";
import { jwtVerify } from "jose";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { templateId } = await params;

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

    const template = await prisma.certificateTemplate.findFirst({
      where: {
        id: templateId,
        issuerId: issuerId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error(`Failed to fetch template ${templateId}:`, error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { templateId } = await params;

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

    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const template = await prisma.certificateTemplate.findUnique({
      where: {
        id: templateId,
        issuerId: issuerId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const updatedTemplate = await prisma.certificateTemplate.update({
      where: { id: templateId },
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { templateId } = await params;

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

    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const template = await prisma.certificateTemplate.findUnique({
      where: { id: templateId, issuerId: issuerId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    await prisma.certificateTemplate.delete({
      where: { id: templateId, issuerId: issuerId },
    });

    return NextResponse.json(
      { message: "Template deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
