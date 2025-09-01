import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";

export async function GET(req: NextRequest) {
  // Public share; no auth required
  const { searchParams } = new URL(req.url);
  const image = searchParams.get("image"); // public image URL
  const text = searchParams.get("text") || "";
  const url = searchParams.get("url") || "";

  // Twitter/X does not allow attaching arbitrary images via web intent.
  // Best effort: include image URL as part of the tweet body so the preview expands.
  const tweet = `"${text}" ${url} ${image ?? ""}`.trim();
  const target = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
  return NextResponse.redirect(target);
}


