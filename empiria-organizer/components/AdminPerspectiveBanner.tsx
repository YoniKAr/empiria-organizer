// components/AdminPerspectiveBanner.tsx
// Sticky banner displayed when an admin is in perspective mode.
// Rendered in the root layout — only visible when perspective is active.

import { getPerspectiveContext } from "@/lib/admin-perspective";
import { ExitPerspectiveButton } from "./ExitPerspectiveButton";

export async function AdminPerspectiveBanner() {
  const ctx = await getPerspectiveContext();

  if (!ctx.isAdminPerspective) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-black">
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>
          Admin Perspective — Viewing as{" "}
          <strong>{ctx.targetOrganizerName || "Unknown Organizer"}</strong>
          {ctx.targetOrganizerEmail && (
            <span className="ml-1 opacity-75">
              ({ctx.targetOrganizerEmail})
            </span>
          )}
        </span>
      </div>
      <ExitPerspectiveButton />
    </div>
  );
}
