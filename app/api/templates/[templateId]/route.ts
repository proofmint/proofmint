import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { JWT_SECRET, TEMPLATES_PATH } from "@/lib/const";
import { jwtVerify } from "jose";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

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

    // Parse multipart form data
    const formData = await request.formData();
    const templateName = formData.get("templateName") as string;
    const templateDescription = formData.get("templateDescription") as string;
    const backgroundImage = formData.get("backgroundImage") as File | null;
    const dynamicFieldsStr = formData.get("dynamicFields") as string;

    // Validate required fields
    if (!templateName || !templateDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let backgroundImageFilename = template.backgroundImageUrl; // Keep existing if no new image

    // Handle new background image if provided
    if (backgroundImage && backgroundImage.size > 0) {
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!allowedTypes.includes(backgroundImage.type)) {
        return NextResponse.json(
          { error: "Invalid image format. Background image must be PNG or JPEG." },
          { status: 400 }
        );
      }

      const maxSize = 5 * 1024 * 1024;
      if (backgroundImage.size > maxSize) {
        return NextResponse.json(
          { error: "Image file is too large. Background image must be under 5MB." },
          { status: 400 }
        );
      }

      // Generate unique filename
      const fileExtension = backgroundImage.type.split("/")[1];
      const filename = `${Date.now()}-${randomUUID()}.${fileExtension}`;

      // Save file to server
      const uploadDir = TEMPLATES_PATH;
      await mkdir(uploadDir, { recursive: true });
      const filepath = path.join(uploadDir, filename);
      const buffer = Buffer.from(await backgroundImage.arrayBuffer());
      await writeFile(filepath, buffer);

      backgroundImageFilename = filename;
    }

    // Parse dynamic fields
    let dynamicFields = [];
    if (dynamicFieldsStr) {
      try {
        dynamicFields = JSON.parse(dynamicFieldsStr);
      } catch {
        return NextResponse.json(
          { error: "Invalid dynamic fields format" },
          { status: 400 }
        );
      }
    }

    const updatedTemplate = await prisma.certificateTemplate.update({
      where: { id: templateId },
      data: {
        templateName,
        templateDescription,
        backgroundImageUrl: backgroundImageFilename,
        dynamicFields: dynamicFields,
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
