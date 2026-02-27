import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { JWT_SECRET } from "@/lib/const";
import { TEMPLATES_PATH } from "@/lib/uploads";
import { jwtVerify } from "jose";
import { writeFile, mkdir, unlink } from "fs/promises";
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

    const oldFilename = template.backgroundImageUrl;
    let newFilename: string | null = null;

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

      const fileExtension = backgroundImage.type.split("/")[1];
      newFilename = `${Date.now()}-${randomUUID()}.${fileExtension}`;

      await mkdir(TEMPLATES_PATH, { recursive: true });
      const buffer = Buffer.from(await backgroundImage.arrayBuffer());
      await writeFile(path.join(TEMPLATES_PATH, newFilename), buffer);
    }

    // Parse dynamic fields
    let dynamicFields = [];
    if (dynamicFieldsStr) {
      try {
        dynamicFields = JSON.parse(dynamicFieldsStr);
      } catch {
        if (newFilename) {
          await unlink(path.join(TEMPLATES_PATH, newFilename)).catch(() => {});
        }
        return NextResponse.json(
          { error: "Invalid dynamic fields format" },
          { status: 400 }
        );
      }
    }

    let updatedTemplate;
    try {
      updatedTemplate = await prisma.certificateTemplate.update({
        where: { id: templateId },
        data: {
          templateName,
          templateDescription,
          backgroundImageUrl: newFilename ?? oldFilename,
          dynamicFields: dynamicFields,
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      // DB failed — remove the newly written file so nothing is left dangling
      if (newFilename) {
        await unlink(path.join(TEMPLATES_PATH, newFilename)).catch(() => {});
      }
      throw dbError;
    }

    // DB succeeded — now it's safe to remove the replaced file
    if (newFilename && oldFilename) {
      await unlink(path.join(TEMPLATES_PATH, oldFilename)).catch((err) =>
        console.error(`Failed to delete old template file ${oldFilename}:`, err)
      );
    }

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

    const imageFilename = template.backgroundImageUrl;

    await prisma.certificateTemplate.delete({
      where: { id: templateId, issuerId: issuerId },
    });

    // DB committed — delete the file; log if it fails but don't surface the error
    if (imageFilename) {
      await unlink(path.join(TEMPLATES_PATH, imageFilename)).catch((err) =>
        console.error(`Failed to delete template file ${imageFilename}:`, err)
      );
    }

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
