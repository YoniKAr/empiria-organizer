// components/ExitPerspectiveButton.tsx
"use client";

export function ExitPerspectiveButton() {
  return (
    <a
      href="/api/admin/exit-perspective"
      className="rounded bg-black/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-black/30"
    >
      Exit Perspective
    </a>
  );
}
