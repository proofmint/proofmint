import prisma from "@/lib/prisma";
import { uploadJsonToPinata, uploadToPinata } from "@/lib/pinata";
import { APPLICATION_HOST, JWT_SECRET, OPERATIONAL_WALLET, algodClient } from "@/lib/const";
import algosdk from "algosdk";
let createCanvas: any, loadImage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ createCanvas, loadImage } = require("@napi-rs/canvas"));
} catch {
  // Fallback stub to avoid bundling native module on edge/client
  createCanvas = () => ({ getContext: () => ({ drawImage() {}, fillText() {}, font: "", fillStyle: "", textAlign: "left" }), toBuffer: () => Buffer.from("") });
  loadImage = async () => ({ width: 800, height: 600 });
}

async function drawCertificate(backgroundUrl: string, fields: any[]): Promise<Buffer> {
  // Load background first to preserve its native aspect ratio
  const bg = await loadImage(backgroundUrl);

  // Use native background dimensions to avoid distortion
  const canvas = createCanvas(bg.width, bg.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bg, 0, 0, bg.width, bg.height);

  // Fields were originally positioned on a base design canvas of 800x600 in the UI.
  // Scale positions (and font sizes) from base to the real background dimensions.
  const BASE_WIDTH = 800;
  const BASE_HEIGHT = 600;
  const scaleX = bg.width / BASE_WIDTH;
  const scaleY = bg.height / BASE_HEIGHT;
  const uniformScale = Math.min(scaleX, scaleY);

  for (const field of fields) {
    const value = field.value || `[${field.name}]`;
    const fontSize = Number(field.fontSize) || 24;
    const fontWeight = field.fontWeight || "normal";
    const color = field.color || "#000000";
    const textAlign = (field.textAlign as CanvasTextAlign) || "left";
    const x = Number(field.x) * scaleX;
    const y = Number(field.y) * scaleY;

    ctx.font = `${fontWeight} ${Math.max(10, Math.round(fontSize * uniformScale))}px Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign;
    ctx.fillText(value, x, y);
  }

  return canvas.toBuffer("image/png");
}

export async function processBulkJob(jobId: string) {
  const job = await prisma.bulkIssuanceJob.findUnique({
    where: { id: jobId },
    include: { template: true, issuer: { include: { user: true } } },
  });
  if (!job) return;

  try {
    await prisma.bulkIssuanceJob.update({ where: { id: job.id }, data: { status: "PROCESSING" } });

    const recipients: Array<{ email: string; fieldData?: Record<string,string> }> = (job.recipientData as any) || [];

    for (const item of recipients) {
      try {
        const dynamicFields = (job.template.dynamicFields as any[]) || [];
        const mergedFields = dynamicFields.map((f: any) => ({ ...f, value: (item.fieldData || {})[f.name] || "" }));
        const imageBuffer = await drawCertificate(job.template.backgroundImageUrl, mergedFields);

        const file = new File([imageBuffer], "certificate.png", { type: "image/png" } as any);
        const pinataResult = await uploadToPinata(file as any);

        const metadata = {
          name: "Certificate",
          unit_name: "CERT",
          creator: job.issuer.user.walletAddress,
          image: `ipfs://${pinataResult.IpfsHash}#arc3`,
          image_mimetype: "image/png",
          properties: mergedFields.map((f: any) => ({ key: f.name, value: (item.fieldData || {})[f.name] || "" })),
        };
        const metadataCid = await uploadJsonToPinata(metadata);

        // TODO: sign and send transactions similar to single-issue endpoint

        await prisma.issuedCertificate.create({
          data: {
            assetId: "",
            templateId: job.template.id,
            receiverEmail: item.email,
            issuerId: job.issuerId,
            fieldData: item.fieldData || {},
            generatedImageUrl: `https://ipfs.io/ipfs/${pinataResult.IpfsHash}`,
            status: "PENDING",
            jobId: job.id,
          },
        });

        await prisma.bulkIssuanceJob.update({ where: { id: job.id }, data: { processedItems: { increment: 1 } } });
      } catch (e) {
        await prisma.bulkIssuanceJob.update({ where: { id: job.id }, data: { failedItems: { increment: 1 } } });
      }
    }

    await prisma.bulkIssuanceJob.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
  } catch (e) {
    await prisma.bulkIssuanceJob.update({ where: { id: job.id }, data: { status: "FAILED" } });
  }
}


