import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { UPLOADS_PATH } from "@/lib/const";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Resolve the requested path and ensure it stays within UPLOADS_PATH
  const requestedPath = path.resolve(UPLOADS_PATH, ...segments);
  if (!requestedPath.startsWith(path.resolve(UPLOADS_PATH))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const file = await fs.readFile(requestedPath);
    const ext = path.extname(requestedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
