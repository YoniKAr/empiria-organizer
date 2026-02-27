// app/layout.tsx
// Root layout — includes the Admin Perspective banner at the top.

import type { Metadata } from "next";
import { AdminPerspectiveBanner } from "@/components/AdminPerspectiveBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empiria — Organizer Dashboard",
  description: "Manage your events, tickets, and revenue.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body>
        {/* Banner renders at the very top, above all dashboard UI.
            It only appears when an admin is in perspective mode. */}
        <AdminPerspectiveBanner />
        {children}
      </body>
    </html>
  );
}
