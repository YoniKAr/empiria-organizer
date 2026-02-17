// lib/admin-perspective.ts
// Handles Admin Perspective mode — allows admins to view/manage
// the organizer dashboard on behalf of a specific organizer.

import { cookies } from "next/headers";
import { getSupabaseAdmin } from "./supabase";
import { auth0 } from "./auth0";

const PERSPECTIVE_COOKIE = "admin_perspective";

// ─── Types ──────────────────────────────────────────────────

export interface PerspectiveContext {
  /** Whether the current session is in admin perspective mode */
  isAdminPerspective: boolean;
  /** The auth0_id to use for all data queries (target organizer or self) */
  effectiveOrganizerId: string;
  /** The logged-in admin's own auth0_id (null if not admin) */
  adminAuth0Id: string | null;
  /** The target organizer's display name (null if not in perspective) */
  targetOrganizerName: string | null;
  /** The target organizer's email (null if not in perspective) */
  targetOrganizerEmail: string | null;
}

// ─── Core Helper ────────────────────────────────────────────

/**
 * Resolves who the current dashboard should display data for.
 *
 * - If an admin is in perspective mode → returns the target organizer's auth0_id
 * - Otherwise → returns the logged-in user's auth0_id
 *
 * Call this in every server component / server action instead of
 * reading the session user directly.
 */
export async function getPerspectiveContext(): Promise<PerspectiveContext> {
  const session = await auth0.getSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  const auth0Id = session.user.sub;
  const supabase = getSupabaseAdmin();

  // Check if the logged-in user is an admin
  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("auth0_id", auth0Id)
    .single();

  const isAdmin = currentUser?.role === "admin";

  // Read the perspective cookie
  const cookieStore = await cookies();
  const perspectiveCookie = cookieStore.get(PERSPECTIVE_COOKIE)?.value;

  // If admin + valid perspective cookie → resolve target organizer
  if (isAdmin && perspectiveCookie) {
    const { data: targetOrganizer } = await supabase
      .from("users")
      .select("auth0_id, full_name, email, role")
      .eq("auth0_id", perspectiveCookie)
      .in("role", ["organizer", "non_profit"])
      .is("deleted_at", null)
      .single();

    if (targetOrganizer) {
      return {
        isAdminPerspective: true,
        effectiveOrganizerId: targetOrganizer.auth0_id,
        adminAuth0Id: auth0Id,
        targetOrganizerName: targetOrganizer.full_name,
        targetOrganizerEmail: targetOrganizer.email,
      };
    }

    // Cookie references invalid/deleted organizer — clear it
    cookieStore.delete(PERSPECTIVE_COOKIE);
  }

  // Default: user is acting as themselves
  return {
    isAdminPerspective: false,
    effectiveOrganizerId: auth0Id,
    adminAuth0Id: isAdmin ? auth0Id : null,
    targetOrganizerName: null,
    targetOrganizerEmail: null,
  };
}

/**
 * Shorthand — just get the effective organizer ID for data queries.
 */
export async function getEffectiveOrganizerId(): Promise<string> {
  const ctx = await getPerspectiveContext();
  return ctx.effectiveOrganizerId;
}

// ─── Cookie Management ──────────────────────────────────────

/**
 * Sets the admin perspective cookie. Called from middleware
 * when an admin arrives with ?as=<auth0_id>.
 */
export async function setAdminPerspectiveCookie(targetAuth0Id: string) {
  const cookieStore = await cookies();
  cookieStore.set(PERSPECTIVE_COOKIE, targetAuth0Id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Session cookie — cleared when browser closes
    // No maxAge = session-scoped
  });
}

/**
 * Clears the admin perspective cookie.
 */
export async function clearAdminPerspectiveCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(PERSPECTIVE_COOKIE);
}
