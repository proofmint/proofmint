import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "@/lib/const";

const secret = new TextEncoder().encode(JWT_SECRET);

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const { pathname } = req.nextUrl;

  if(pathname.startsWith("/claim/") || pathname.startsWith("/share/")){
    return NextResponse.next();
  }

  const publicPaths = ["/auth/login", "/auth/register", "/auth/verify-email", "/auth/verify-token", "/"];

  if (publicPaths.includes(pathname)) {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, secret);
        const role = (payload as any).role;
        const url = req.nextUrl.clone();
        url.pathname = `/${role.toLowerCase()}/dashboard`;
        return NextResponse.redirect(url);
      } catch (error) {
        // Invalid token, allow access to public pages
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as any).role;

    const isIssuerRoute = pathname.startsWith("/issuer");
    const isReceiverRoute = pathname.startsWith("/receiver");

    if (role === "ISSUER" && !isIssuerRoute) {
      const url = req.nextUrl.clone();
      url.pathname = "/issuer/dashboard";
      return NextResponse.redirect(url);
    }

    if (role === "RECEIVER" && !isReceiverRoute) {
      const url = req.nextUrl.clone();
      url.pathname = "/receiver/dashboard";
      return NextResponse.redirect(url);
    }
  } catch (err) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/issuer/:path*",
    "/receiver/:path*",
  ],
};
