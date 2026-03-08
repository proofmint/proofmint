import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import prisma from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/const";
import { TEMPLATES_PATH } from "@/lib/uploads";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

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

    // Parse multipart form data
    const formData = await request.formData();
    const templateName = formData.get("templateName") as string;
    const templateDescription = formData.get("templateDescription") as string;
    const backgroundImage = formData.get("backgroundImage") as File | null;
    const dynamicFieldsStr = formData.get("dynamicFields") as string;

    // Validate required fields
    if (!templateName || !templateDescription || !backgroundImage) {
      return NextResponse.json(
        { 
          error: "Missing required fields. Please provide template name, description, and background image.",
          requiredFields: ["templateName", "templateDescription", "backgroundImage"]
        },
        { status: 400 }
      );
    }

    // Validate image file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(backgroundImage.type)) {
      return NextResponse.json(
        { 
          error: "Invalid image format. Background image must be PNG or JPEG.",
          allowedFormats: ["PNG", "JPEG", "JPG"],
          receivedFormat: backgroundImage.type
        },
        { status: 400 }
      );
    }

    // Validate image file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (backgroundImage.size > maxSize) {
      const sizeMB = (backgroundImage.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        { 
          error: `Image file is too large (${sizeMB}MB). Background image must be under 5MB.`,
          maxSize: "5MB",
          actualSize: `${sizeMB}MB`,
          suggestion: "Please compress or resize your image and try again."
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = backgroundImage.type.split("/")[1];
    const filename = `${Date.now()}-${randomUUID()}.${fileExtension}`;

    // Save file to server
    const filepath = path.join(TEMPLATES_PATH, filename);
    const buffer = Buffer.from(await backgroundImage.arrayBuffer());
    await writeFile(filepath, buffer);

    // Parse dynamic fields
    let dynamicFields = [];
    if (dynamicFieldsStr) {
      try {
        dynamicFields = JSON.parse(dynamicFieldsStr);
      } catch {
        return NextResponse.json(
          { 
            error: "Invalid dynamic fields format. The dynamicFields must be valid JSON.",
            suggestion: "Please check your JSON syntax and try again."
          },
          { status: 400 }
        );
      }

      // Validate dynamic fields array
      if (!Array.isArray(dynamicFields)) {
        return NextResponse.json(
          { 
            error: "Invalid dynamic fields format. The dynamicFields must be an array of field objects.",
            suggestion: "Ensure dynamicFields is formatted as a JSON array."
          },
          { status: 400 }
        );
      }

      // Validate each field
      for (let i = 0; i < dynamicFields.length; i++) {
        const field = dynamicFields[i];
        const fieldPrefix = `Field ${i + 1}`;

        // Validate required properties
        if (!field.name || typeof field.name !== "string") {
          return NextResponse.json(
            { 
              error: `${fieldPrefix}: Field name is required and must be a text value.`,
              suggestion: "Each field must have a 'name' property."
            },
            { status: 400 }
          );
        }

        if (field.name.length < 1 || field.name.length > 50) {
          return NextResponse.json(
            { 
              error: `${fieldPrefix}: Field name "${field.name}" is invalid. Name must be 1-50 characters long.`,
              suggestion: "Please use a shorter field name."
            },
            { status: 400 }
          );
        }

        if (typeof field.x !== "number") {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): X coordinate is required and must be a number.`,
              suggestion: "Provide the horizontal position as a number (e.g., 100)."
            },
            { status: 400 }
          );
        }

        if (field.x < 0) {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): X coordinate must be non-negative (got ${field.x}).`,
              suggestion: "Use a positive number or 0 for the X coordinate."
            },
            { status: 400 }
          );
        }

        if (typeof field.y !== "number") {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Y coordinate is required and must be a number.`,
              suggestion: "Provide the vertical position as a number (e.g., 200)."
            },
            { status: 400 }
          );
        }

        if (field.y < 0) {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Y coordinate must be non-negative (got ${field.y}).`,
              suggestion: "Use a positive number or 0 for the Y coordinate."
            },
            { status: 400 }
          );
        }

        if (typeof field.fontSize !== "number") {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Font size is required and must be a number.`,
              suggestion: "Provide a font size between 8 and 200."
            },
            { status: 400 }
          );
        }

        if (field.fontSize < 8 || field.fontSize > 200) {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Font size must be between 8 and 200 (got ${field.fontSize}).`,
              suggestion: "Use a font size within the valid range for better readability."
            },
            { status: 400 }
          );
        }

        if (!field.fontFamily || typeof field.fontFamily !== "string") {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Font family is required and must be a text value.`,
              suggestion: "Specify a font family (e.g., 'Arial', 'Times New Roman')."
            },
            { status: 400 }
          );
        }

        if (field.fontFamily.length === 0) {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Font family cannot be empty.`,
              suggestion: "Provide a valid font family name."
            },
            { status: 400 }
          );
        }

        if (!field.color || typeof field.color !== "string") {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Color is required and must be a text value.`,
              suggestion: "Provide a color in hex format (e.g., '#000000' for black)."
            },
            { status: 400 }
          );
        }

        // Validate color is valid hex format (#RRGGBB)
        const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
        if (!hexColorRegex.test(field.color)) {
          return NextResponse.json(
            { 
              error: `${fieldPrefix} (${field.name}): Color "${field.color}" is invalid. Must be in hex format (#RRGGBB).`,
              example: "#FF0000 for red, #000000 for black",
              suggestion: "Use a 6-digit hex color code starting with #."
            },
            { status: 400 }
          );
        }

        // Validate optional properties
        if (field.maxWidth !== undefined) {
          if (typeof field.maxWidth !== "number" || field.maxWidth <= 0) {
            return NextResponse.json(
              { 
                error: `${fieldPrefix} (${field.name}): maxWidth must be a positive number (got ${field.maxWidth}).`,
                suggestion: "Provide a positive number for maximum width, or omit this field."
              },
              { status: 400 }
            );
          }
        }

        if (field.maxHeight !== undefined) {
          if (typeof field.maxHeight !== "number" || field.maxHeight <= 0) {
            return NextResponse.json(
              { 
                error: `${fieldPrefix} (${field.name}): maxHeight must be a positive number (got ${field.maxHeight}).`,
                suggestion: "Provide a positive number for maximum height, or omit this field."
              },
              { status: 400 }
            );
          }
        }

        if (field.align !== undefined) {
          const validAlignments = ["left", "center", "right"];
          if (!validAlignments.includes(field.align)) {
            return NextResponse.json(
              { 
                error: `${fieldPrefix} (${field.name}): Alignment "${field.align}" is invalid. Must be 'left', 'center', or 'right'.`,
                validOptions: validAlignments,
                suggestion: "Use one of the valid alignment options."
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Create the template (store only filename in database)
    const template = await prisma.certificateTemplate.create({
      data: {
        issuerId: issuerId,
        templateName,
        templateDescription,
        backgroundImageUrl: filename,
        dynamicFields: dynamicFields,
      },
    });

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { 
        error: "An unexpected error occurred while creating the template.",
        suggestion: "Please verify all fields are correct and try again. Contact support if the issue persists."
      },
      { status: 500 }
    );
  }
}
