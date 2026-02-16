import { auth0 } from '@/lib/auth0';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export default async function OrganizerRoot() {
  // 1. Check Session (Shared Cookie)
  const session = await auth0.getSession();

  // 2. Not Logged In? -> Redirect to Login
  // The Middleware usually handles this, but this is a double-check.
  if (!session?.user) {
    redirect('/auth/login?returnTo=/dashboard');
  }

  // 3. Logged In? -> Check Role in Supabase
  // We use the Service Role Key (Safe on Server) to verify they are actually an organizer
  import { getSupabaseAdmin } from '@/lib/supabase';
  const supabase = getSupabaseAdmin();
 

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth0_id', session.user.sub)
    .single();

  // 4. Security Check: Are they allowed in?
  // If they are an "attendee", they are NOT allowed in the dashboard.
  if (!profile || (profile.role !== 'organizer' && profile.role !== 'non_profit')) {
    redirect('/unauthorized'); // Send them to the "Wrong Door" page
  }

  // 5. Authorized -> Enter the Dashboard
  redirect('/dashboard');
}
