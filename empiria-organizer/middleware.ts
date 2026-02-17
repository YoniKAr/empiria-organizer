import { type NextRequest, NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";

export async function middleware(request: NextRequest) {
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

  // Standard Auth0 v4 middleware
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
