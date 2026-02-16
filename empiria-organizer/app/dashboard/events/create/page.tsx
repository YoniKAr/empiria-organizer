import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import CreateEventWizard from './CreateEventWizard';

export default async function CreateEventPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=/dashboard/events/create');

  const supabase = getSupabaseAdmin();

  // Gate: Stripe must be connected before creating events
  const { data: user } = await supabase
    .from('users')
    .select('stripe_onboarding_completed')
    .eq('auth0_id', session.user.sub)
    .single();

  if (!user?.stripe_onboarding_completed) {
    redirect('/dashboard/payments?reason=stripe_required');
  }

  // Fetch categories for the dropdown
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name');

  return <CreateEventWizard categories={categories || []} />;
}
