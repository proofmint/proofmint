import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  const text = searchParams.get("text") || "";
  // LinkedIn share: include URL; image is pulled by LinkedIn from the URL OG tags if available
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&mini=true&summary=${encodeURIComponent(text)}`;
  return NextResponse.redirect(li);
}


