import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=/dashboard/settings');

  const email = session.user.email ?? '';

  return <SettingsClient email={email} />;
}
