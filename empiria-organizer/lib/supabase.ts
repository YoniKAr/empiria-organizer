import { createClient } from '@supabase/supabase-js';

// Admin client — bypasses RLS (use only in server-side API routes / server components)
export function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // service_role key, NOT the anon key
  );
}

// Anon client — respects RLS (use when you want user-scoped queries)
export function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}
