/**
 * Image Generator Service
 * 
 * Generates unique certificate images by rendering text fields onto template backgrounds
 * using server-side canvas rendering with @napi-rs/canvas.
 */

import { createCanvas, loadImage, Canvas, SKRSContext2D, GlobalFonts } from '@napi-rs/canvas';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import prisma from '../prisma';
import { DynamicField, CertificateTemplate } from '../types/certificate';
import { TEMPLATES_PATH } from '../const';
import { CERTIFICATE_FONTS } from '../certificateFonts';

// Register custom fonts from public/fonts/ at module load time.
// Missing font files are skipped gracefully — the canvas falls back to the system default.
for (const font of CERTIFICATE_FONTS) {
  if (!font.file) continue;
  const fontPath = path.join(process.cwd(), 'public', 'fonts', font.file);
  if (!existsSync(fontPath)) {
    console.warn(`[ImageGenerator] Font file not found, skipping: ${font.file}`);
    continue;
  }
  try {
    GlobalFonts.registerFromPath(fontPath, font.name);
    console.log(`[ImageGenerator] Registered font: ${font.name}`);
  } catch (err) {
    console.warn(`[ImageGenerator] Failed to register font ${font.name}:`, err);
  }
}

/**
 * Loads a template from the database
 * 
 * @param templateId - The template ID to load
 * @returns Template configuration
 * @throws Error if template not found
 */
async function loadTemplate(templateId: string): Promise<CertificateTemplate> {
  console.log(`[ImageGenerator] Loading template ${templateId}`);
  
  const template = await prisma.certificateTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    console.error(`[ImageGenerator] Template not found: ${templateId}`);
    throw new Error(`Template not found: ${templateId}`);
  }

  console.log(`[ImageGenerator] Successfully loaded template ${templateId}`);
  return {
    id: template.id,
    issuerId: template.issuerId,
    templateName: template.templateName,
    templateDescription: template.templateDescription,
    backgroundImageUrl: template.backgroundImageUrl,
    dynamicFields: template.dynamicFields as unknown as DynamicField[],
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/**
 * Loads a background image from the server filesystem
 * 
 * @param filename - The background image filename
 * @returns Image buffer
 * @throws Error if image file not found or cannot be read
 */
async function loadBackgroundImage(filename: string): Promise<Buffer> {
  const imagePath = path.join(
    TEMPLATES_PATH,
    filename
  );

  console.log(`[ImageGenerator] Loading background image from ${imagePath}`);

  try {
    const imageBuffer = await fs.readFile(imagePath);
    console.log(`[ImageGenerator] Successfully loaded background image: ${filename}`);
    return imageBuffer;
  } catch (error) {
    console.error(`[ImageGenerator] Failed to load background image ${filename}:`, error);
    throw new Error(`Failed to load background image: ${filename}. Error: ${error}`);
  }
}

/**
 * Creates a canvas with the specified dimensions
 * 
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns Canvas instance
 */
function createCanvasWithDimensions(width: number, height: number): Canvas {
  return createCanvas(width, height);
}

/**
 * Renders a text field on the canvas at the specified position
 * Handles text wrapping and font scaling based on field constraints
 * 
 * @param ctx - Canvas 2D context
 * @param field - Dynamic field definition
 * @param text - Text content to render
 */
function renderTextField(
  ctx: SKRSContext2D,
  field: DynamicField,
  text: string
): void {
  // Set initial font properties
  let fontSize = field.fontSize;
  const fontWeight = field.fontWeight || 'normal';
  ctx.font = `${fontWeight} ${fontSize}px ${field.fontFamily}`;
  ctx.fillStyle = field.color;
  ctx.textAlign = (field.align || 'left') as CanvasTextAlign;

  // Calculate text metrics
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  // Check if wrapping is needed
  if (field.maxWidth && textWidth > field.maxWidth) {
    // Wrap text into multiple lines
    const lines = wrapText(ctx, text, field.maxWidth);
    const lineHeight = fontSize * 1.2; // Standard line height multiplier
    const totalHeight = lines.length * lineHeight;

    // Check if scaling is needed
    if (field.maxHeight && totalHeight > field.maxHeight) {
      // Calculate scale factor to fit within maxHeight
      const scaleFactor = field.maxHeight / totalHeight;
      fontSize = fontSize * scaleFactor;
      
      // Update font with scaled size
      ctx.font = `${fontWeight} ${fontSize}px ${field.fontFamily}`;
      
      // Recalculate line height with scaled font
      const scaledLineHeight = fontSize * 1.2;
      
      // Draw wrapped and scaled lines
      lines.forEach((line, index) => {
        ctx.fillText(line, field.x, field.y + index * scaledLineHeight);
      });
    } else {
      // Draw wrapped lines without scaling
      lines.forEach((line, index) => {
        ctx.fillText(line, field.x, field.y + index * lineHeight);
      });
    }
  } else {
    // Draw single line without wrapping
    ctx.fillText(text, field.x, field.y);
  }
}

/**
 * Wraps text into multiple lines based on maximum width
 * 
 * @param ctx - Canvas 2D context
 * @param text - Text to wrap
 * @param maxWidth - Maximum width in pixels
 * @returns Array of text lines
 */
function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      // Current line exceeds maxWidth, push it and start new line
      lines.push(currentLine);
      currentLine = word;
    } else {
      // Add word to current line
      currentLine = testLine;
    }
  }

  // Push the last line
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates a certificate image from a template and field data
 * 
 * @param templateId - The template ID to use for generation
 * @param fieldData - Dynamic field values to render
 * @returns PNG image buffer
 */
export async function generateCertificate(
  templateId: string,
  fieldData: Record<string, string>
): Promise<Buffer> {
  console.log(`[ImageGenerator] Starting certificate generation for template ${templateId}`);
  
  try {
    // Load template from database
    const template = await loadTemplate(templateId);

    // Load background image from filesystem
    const imageBuffer = await loadBackgroundImage(template.backgroundImageUrl);
    const backgroundImage = await loadImage(imageBuffer);

    console.log(`[ImageGenerator] Creating canvas with dimensions ${backgroundImage.width}x${backgroundImage.height}`);
    
    // Create canvas with template dimensions
    const canvas = createCanvasWithDimensions(backgroundImage.width, backgroundImage.height);
    const ctx = canvas.getContext('2d');

    // Draw background image
    ctx.drawImage(backgroundImage, 0, 0);

    // Render dynamic fields
    console.log(`[ImageGenerator] Rendering ${template.dynamicFields.length} dynamic fields`);
    for (const field of template.dynamicFields) {
      const text = fieldData[field.name] || '';
      if (text) {
        renderTextField(ctx, field, text);
      }
    }

    // Export canvas to PNG buffer
    const pngBuffer = canvas.toBuffer('image/png');
    console.log(`[ImageGenerator] Successfully generated certificate image (${pngBuffer.length} bytes)`);
    
    return pngBuffer;
  } catch (error) {
    console.error(`[ImageGenerator] Failed to generate certificate for template ${templateId}:`, error);
    throw error;
  }
}
