'use server';

import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TicketTierInput {
  name: string;
  description: string;
  price: number;
  currency: string;
  initial_quantity: number;
  max_per_order: number;
  sales_start_at: string;
  sales_end_at: string;
  is_hidden: boolean;
}

interface EventFormInput {
  title: string;
  slug: string;
  description: string;
  category_id: string;
  tags: string[];
  cover_image_url: string;
  start_at: string;
  end_at: string;
  location_type: string;
  venue_name: string;
  address_text: string;
  city: string;
  currency: string;
  ticket_tiers: TicketTierInput[];
}

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getAuthUser() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return null;
  return session.user;
}

async function requireStripeConnected(authId: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('stripe_onboarding_completed')
    .eq('auth0_id', authId)
    .single();

  return user?.stripe_onboarding_completed === true;
}

function buildTiers(eventId: string, tiers: TicketTierInput[]) {
  return tiers.map((t) => ({
    event_id: eventId,
    name: t.name,
    description: t.description || null,
    price: t.price || 0,
    currency: t.currency || 'cad',
    initial_quantity: t.initial_quantity,
    remaining_quantity: t.initial_quantity,
    max_per_order: t.max_per_order || 10,
    sales_start_at: t.sales_start_at || null,
    sales_end_at: t.sales_end_at || null,
    is_hidden: t.is_hidden || false,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function createEvent(form: EventFormInput): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!(await requireStripeConnected(user.sub))) {
    return { success: false, error: 'Stripe account must be connected before creating events' };
  }

  const supabase = getSupabaseAdmin();

  const totalCapacity = form.ticket_tiers.reduce((sum, t) => sum + (t.initial_quantity || 0), 0);

  // Create event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      organizer_id: user.sub,
      title: form.title,
      slug: form.slug,
      description: form.description ? JSON.stringify({ text: form.description }) : null,
      category_id: form.category_id || null,
      tags: form.tags || [],
      cover_image_url: form.cover_image_url || null,
      start_at: form.start_at,
      end_at: form.end_at,
      location_type: form.location_type || 'physical',
      venue_name: form.venue_name || null,
      address_text: form.address_text || null,
      city: form.city || null,
      currency: form.currency || 'cad',
      total_capacity: totalCapacity,
      status: 'draft',
      source_app: 'organizer.empiria',
    })
    .select('id')
    .single();

  if (eventError) {
    console.error('Event insert error:', eventError);
    return { success: false, error: eventError.message };
  }

  // Create ticket tiers
  if (form.ticket_tiers.length > 0) {
    const { error: tierError } = await supabase
      .from('ticket_tiers')
      .insert(buildTiers(event.id, form.ticket_tiers));

    if (tierError) {
      console.error('Tier insert error:', tierError);
      await supabase.from('events').delete().eq('id', event.id);
      return { success: false, error: tierError.message };
    }
  }

  return { success: true, data: { id: event.id } };
}

export async function updateEvent(
  eventId: string,
  form: EventFormInput
): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: existing } = await supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', eventId)
    .single();

  if (!existing || existing.organizer_id !== user.sub) {
    return { success: false, error: 'Not found or not authorized' };
  }

  const totalCapacity = form.ticket_tiers.reduce((sum, t) => sum + (t.initial_quantity || 0), 0);

  const { error: updateError } = await supabase
    .from('events')
    .update({
      title: form.title,
      slug: form.slug,
      description: form.description ? JSON.stringify({ text: form.description }) : null,
      category_id: form.category_id || null,
      tags: form.tags || [],
      cover_image_url: form.cover_image_url || null,
      start_at: form.start_at,
      end_at: form.end_at,
      location_type: form.location_type || 'physical',
      venue_name: form.venue_name || null,
      address_text: form.address_text || null,
      city: form.city || null,
      currency: form.currency || 'cad',
      total_capacity: totalCapacity,
    })
    .eq('id', eventId);

  if (updateError) return { success: false, error: updateError.message };

  // Replace ticket tiers
  if (form.ticket_tiers.length > 0) {
    await supabase.from('ticket_tiers').delete().eq('event_id', eventId);

    const { error: tierError } = await supabase
      .from('ticket_tiers')
      .insert(buildTiers(eventId, form.ticket_tiers));

    if (tierError) return { success: false, error: tierError.message };
  }

  return { success: true, data: { id: eventId } };
}

export async function publishEvent(eventId: string): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, status, title, start_at, end_at')
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== user.sub) {
    return { success: false, error: 'Not found' };
  }

  if (event.status !== 'draft') {
    return { success: false, error: `Cannot publish event with status "${event.status}"` };
  }

  if (!event.title || !event.start_at || !event.end_at) {
    return { success: false, error: 'Event must have a title, start date, and end date' };
  }

  const { count } = await supabase
    .from('ticket_tiers')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (!count || count === 0) {
    return { success: false, error: 'Event must have at least one ticket tier' };
  }

  const { error } = await supabase
    .from('events')
    .update({ status: 'published' })
    .eq('id', eventId);

  if (error) return { success: false, error: error.message };

  return { success: true, data: { id: eventId } };
}

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function createStripeConnectLink(): Promise<ActionResult<{ url: string; type: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const supabase = getSupabaseAdmin();

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_onboarding_completed, email')
    .eq('auth0_id', user.sub)
    .single();

  if (!profile) return { success: false, error: 'User not found' };

  let accountId = profile.stripe_account_id;

  // Create Stripe Express account if none exists
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CA',
      email: profile.email || user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        auth0_id: user.sub,
        platform: 'empiria',
      },
    });

    accountId = account.id;

    await supabase
      .from('users')
      .update({ stripe_account_id: accountId })
      .eq('auth0_id', user.sub);
  }

  // Already onboarded → return dashboard link
  if (profile.stripe_onboarding_completed) {
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return { success: true, data: { url: loginLink.url, type: 'dashboard' } };
  }

  // Generate onboarding link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://organizer.empiriaindia.com';

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/api/stripe/connect-callback?status=refresh`,
    return_url: `${baseUrl}/api/stripe/connect-callback?status=complete`,
    type: 'account_onboarding',
  });

  return { success: true, data: { url: accountLink.url, type: 'onboarding' } };
}
