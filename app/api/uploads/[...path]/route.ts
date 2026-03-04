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
    // If the last segment has no extension, treat it as a CID and scan for {cid}.*
    const lastSegment = segments[segments.length - 1];
    let filePath = requestedPath;

    if (!path.extname(lastSegment)) {
      const dir = path.resolve(UPLOADS_PATH, ...segments.slice(0, -1));
      const files = await fs.readdir(dir);
      const match = files.find((f) => {
        const name = path.parse(f).name;
        return name === lastSegment;
      });
      if (!match) {
        return new NextResponse("Not Found", { status: 404 });
      }
      filePath = path.join(dir, match);
    }

    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
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
