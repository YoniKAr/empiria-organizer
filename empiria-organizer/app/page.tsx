import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  const supabase = getSupabaseAdmin();
 

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth0_id', session.user.sub)
    .single();

  // 4. Security Check: Are they allowed in?
  // Organizers, non-profits, and admins (admin perspective mode) are allowed.
  const allowedRoles = ['organizer', 'non_profit', 'admin'];
  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/unauthorized');
  }

  // 5. Authorized -> Enter the Dashboard
  redirect('/dashboard');
}
