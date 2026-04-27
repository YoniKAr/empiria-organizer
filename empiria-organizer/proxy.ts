import { type NextRequest, NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";

export async function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const asParam = searchParams.get("as");

  // If ?as= param is present, set the perspective cookie
  // and redirect to a clean URL (strip the param)
  if (asParam) {
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete("as");

    const response = NextResponse.redirect(cleanUrl);

    if (asParam.trim()) {
      // Set perspective cookie — validation happens server-side
      response.cookies.set("admin_perspective", asParam, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    return response;
  }

  // Only run auth0.middleware() for /auth/* routes (login, callback, logout).
  // For all other routes, pass through — avoids the SDK misinterpreting
  // query params or unnecessarily rolling sessions on every request.
  if (request.nextUrl.pathname.startsWith("/auth/")) {
    try {
      return await auth0.middleware(request);
    } catch {
      const response = NextResponse.redirect(new URL("/auth/login", request.url));
      response.cookies.set("appSession", "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
