import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=/dashboard/settings');

  const email = session.user.email ?? '';
  const isGoogleUser = typeof session.user.sub === 'string' && session.user.sub.startsWith('google-oauth2|');

  // Fetch the user's stored profile from Supabase
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, avatar_url')
    .eq('auth0_id', session.user.sub)
    .single();

  const fullName = profile?.full_name ?? '';
  const spaceIndex = fullName.indexOf(' ');
  const firstName = spaceIndex === -1 ? fullName : fullName.slice(0, spaceIndex);
  const lastName = spaceIndex === -1 ? '' : fullName.slice(spaceIndex + 1);
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <SettingsClient
      email={email}
      isGoogleUser={isGoogleUser}
      defaultFirstName={firstName}
      defaultLastName={lastName}
      defaultAvatarUrl={avatarUrl}
    />
  );
}
