// app/api/admin/exit-perspective/route.ts
// Clears the admin perspective cookie and redirects back to the admin dashboard.

import { NextResponse } from "next/server";

const ADMIN_APP_URL = "https://admin.empiriaindia.com";

export async function GET() {
  const response = NextResponse.redirect(ADMIN_APP_URL);

  // Clear the perspective cookie
  response.cookies.set("admin_perspective", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Expire immediately
  });

  return response;
}
