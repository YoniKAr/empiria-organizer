'use server';

import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveOrganizerId } from '@/lib/admin-perspective';
import { stripe } from '@/lib/stripe';
import { toStripeAmount } from '@/lib/utils';
import { sendTicketCancellationEmail } from '@/lib/email';
import { sendTicketEmail } from '@/lib/ticket-email';

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

interface OccurrenceInput {
  starts_at: string;
  ends_at: string;
  label: string;
}

interface EventFormInput {
  title: string;
  slug: string;
  description: string;
  category_id: string;
  tags: string[];
  cover_image_url: string;
  sales_start_at: string;
  sales_end_at: string;
  occurrences: OccurrenceInput[];
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

  const effectiveOrgId = await getEffectiveOrganizerId();

  if (!(await requireStripeConnected(effectiveOrgId))) {
    return { success: false, error: 'Stripe account must be connected before creating events' };
  }

  const supabase = getSupabaseAdmin();

  const totalCapacity = form.ticket_tiers.reduce((sum, t) => sum + (t.initial_quantity || 0), 0);

  // Create event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      organizer_id: effectiveOrgId,
      title: form.title,
      slug: form.slug,
      description: form.description ? JSON.stringify({ text: form.description }) : null,
      category_id: form.category_id || null,
      tags: form.tags || [],
      cover_image_url: form.cover_image_url || null,
      sales_start_at: form.sales_start_at || null,
      sales_end_at: form.sales_end_at || null,
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

  // Create event occurrences
  if (form.occurrences.length > 0) {
    const { error: occError } = await supabase
      .from('event_occurrences')
      .insert(
        form.occurrences.map((o) => ({
          event_id: event.id,
          starts_at: o.starts_at,
          ends_at: o.ends_at,
          label: o.label || null,
        }))
      );

    if (occError) {
      console.error('Occurrence insert error:', occError);
      await supabase.from('events').delete().eq('id', event.id);
      return { success: false, error: occError.message };
    }
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

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: existing } = await supabase
    .from('events')
    .select('id, organizer_id')
    .eq('id', eventId)
    .single();

  if (!existing || existing.organizer_id !== effectiveOrgId) {
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
      sales_start_at: form.sales_start_at || null,
      sales_end_at: form.sales_end_at || null,
      location_type: form.location_type || 'physical',
      venue_name: form.venue_name || null,
      address_text: form.address_text || null,
      city: form.city || null,
      currency: form.currency || 'cad',
      total_capacity: totalCapacity,
    })
    .eq('id', eventId);

  if (updateError) return { success: false, error: updateError.message };

  // Replace occurrences
  if (form.occurrences.length > 0) {
    await supabase.from('event_occurrences').delete().eq('event_id', eventId);

    const { error: occError } = await supabase
      .from('event_occurrences')
      .insert(
        form.occurrences.map((o) => ({
          event_id: eventId,
          starts_at: o.starts_at,
          ends_at: o.ends_at,
          label: o.label || null,
        }))
      );

    if (occError) return { success: false, error: occError.message };
  }

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

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, status, title')
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Not found' };
  }

  if (event.status !== 'draft') {
    return { success: false, error: `Cannot publish event with status "${event.status}"` };
  }

  if (!event.title) {
    return { success: false, error: 'Event must have a title' };
  }

  // Require at least one occurrence
  const { count: occCount } = await supabase
    .from('event_occurrences')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (!occCount || occCount === 0) {
    return { success: false, error: 'Event must have at least one event date' };
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

export async function unpublishEvent(eventId: string): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, status')
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Not found' };
  }

  if (event.status !== 'published') {
    return { success: false, error: `Cannot unpublish event with status "${event.status}"` };
  }

  const { error } = await supabase
    .from('events')
    .update({ status: 'draft' })
    .eq('id', eventId);

  if (error) return { success: false, error: error.message };

  return { success: true, data: { id: eventId } };
}

export async function cancelEvent(eventId: string): Promise<ActionResult<{ id: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, status')
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Not found' };
  }

  if (event.status === 'cancelled') {
    return { success: false, error: 'Event is already cancelled' };
  }

  const { error } = await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId);

  if (error) return { success: false, error: error.message };

  return { success: true, data: { id: eventId } };
}

export async function deleteEvent(
  eventId: string,
  reason?: string,
  releaseToPool?: boolean
): Promise<ActionResult<{ id: string; mode: 'deleted' | 'cancelled' }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, status, title, venue_name, city, total_tickets_sold')
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Not found' };
  }

  // Fetch first occurrence for email date
  const { data: firstOcc } = await supabase
    .from('event_occurrences')
    .select('starts_at')
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const eventDateForEmail = firstOcc?.starts_at || '';

  // Check if any tickets were ever issued (including cancelled/refunded/used)
  const { count: ticketCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  const hasTickets = (ticketCount || 0) > 0;

  if (!hasTickets) {
    // No tickets ever — hard delete event + tiers from DB
    await supabase.from('ticket_tiers').delete().eq('event_id', eventId);

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) return { success: false, error: error.message };

    return { success: true, data: { id: eventId, mode: 'deleted' } };
  }

  // Tickets exist — refund all valid ones, then mark event as cancelled
  if (!reason?.trim()) {
    return { success: false, error: 'A cancellation reason is required when tickets have been issued' };
  }

  // Find all valid tickets grouped by order
  const { data: validTickets } = await supabase
    .from('tickets')
    .select('id, order_id, attendee_name, attendee_email, tier_id')
    .eq('event_id', eventId)
    .eq('status', 'valid');

  if (validTickets && validTickets.length > 0) {
    // Group by order for batched Stripe refunds
    const orderGroups = new Map<string, typeof validTickets>();
    for (const t of validTickets) {
      if (!t.order_id) continue;
      const group = orderGroups.get(t.order_id) || [];
      group.push(t);
      orderGroups.set(t.order_id, group);
    }

    // Fetch all tiers in one query
    const tierIds = [...new Set(validTickets.map((t) => t.tier_id))];
    const { data: tiers } = await supabase
      .from('ticket_tiers')
      .select('id, name, price, currency')
      .in('id', tierIds);
    const tierMap = new Map((tiers || []).map((t) => [t.id, t]));

    // Process each order
    for (const [orderId, orderTickets] of orderGroups) {
      const { data: order } = await supabase
        .from('orders')
        .select('stripe_payment_intent_id, currency')
        .eq('id', orderId)
        .single();

      if (!order?.stripe_payment_intent_id) continue;

      // Calculate total refund for this order's valid tickets
      let totalRefundStripe = 0;
      for (const t of orderTickets) {
        const tier = tierMap.get(t.tier_id);
        if (tier) {
          totalRefundStripe += toStripeAmount(tier.price, tier.currency || order.currency || 'cad');
        }
      }

      if (totalRefundStripe > 0) {
        try {
          await stripe.refunds.create({
            payment_intent: order.stripe_payment_intent_id,
            amount: totalRefundStripe,
            reason: 'requested_by_customer',
            reverse_transfer: true,
            refund_application_fee: true,
          });
        } catch (err) {
          console.error(`Stripe refund error for order ${orderId}:`, err);
        }
      }
    }

    const newStatus = releaseToPool ? 'refunded' : 'cancelled';

    // Mark all valid tickets
    await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('event_id', eventId)
      .eq('status', 'valid');

    // Restore inventory if releasing to pool
    if (releaseToPool) {
      for (const tierId of tierIds) {
        const count = validTickets.filter((t) => t.tier_id === tierId).length;
        const { data: currentTier } = await supabase
          .from('ticket_tiers')
          .select('remaining_quantity')
          .eq('id', tierId)
          .single();

        if (currentTier) {
          await supabase
            .from('ticket_tiers')
            .update({ remaining_quantity: currentTier.remaining_quantity + count })
            .eq('id', tierId);
        }
      }

      const { data: currentEvent } = await supabase
        .from('events')
        .select('total_tickets_sold')
        .eq('id', eventId)
        .single();

      if (currentEvent) {
        await supabase
          .from('events')
          .update({ total_tickets_sold: Math.max(0, currentEvent.total_tickets_sold - validTickets.length) })
          .eq('id', eventId);
      }
    }

    // Send cancellation emails — one per unique attendee
    const attendeeMap = new Map<string, { name: string; tierNames: string[]; refund: number }>();
    for (const t of validTickets) {
      const tier = tierMap.get(t.tier_id);
      const existing = attendeeMap.get(t.attendee_email);
      if (existing) {
        existing.tierNames.push(tier?.name || 'Unknown');
        existing.refund += tier?.price || 0;
      } else {
        attendeeMap.set(t.attendee_email, {
          name: t.attendee_name,
          tierNames: [tier?.name || 'Unknown'],
          refund: tier?.price || 0,
        });
      }
    }

    const currency = (tiers && tiers[0]?.currency) || 'cad';
    for (const [email, { name, tierNames, refund }] of attendeeMap) {
      try {
        await sendTicketCancellationEmail({
          to: email,
          attendeeName: name,
          eventTitle: event.title,
          eventDate: eventDateForEmail,
          venueName: event.venue_name || '',
          city: event.city || '',
          tierName: tierNames.join(', '),
          reason: reason.trim(),
          refundAmount: refund,
          currency,
        });
      } catch (emailErr) {
        console.error('Failed to send cancellation email to', email, emailErr);
      }
    }
  }

  // Mark event as cancelled
  await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId);

  return { success: true, data: { id: eventId, mode: 'cancelled' } };
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
    .select('stripe_account_id, stripe_onboarding_completed, stripe_account_type, email')
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
      metadata: {
        auth0_id: user.sub,
        platform: 'empiria',
      },
    });

    accountId = account.id;

    await supabase
      .from('users')
      .update({ stripe_account_id: accountId, stripe_account_type: 'express' })
      .eq('auth0_id', user.sub);
  }

  // Already onboarded → return dashboard link
  if (profile.stripe_onboarding_completed) {
    if (profile.stripe_account_type === 'standard') {
      return { success: true, data: { url: 'https://dashboard.stripe.com', type: 'dashboard' } };
    }
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

export async function createStripeStandardConnectLink(): Promise<ActionResult<{ url: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) return { success: false, error: 'Stripe OAuth is not configured' };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://organizer.empiriaindia.com';
  const redirectUri = `${baseUrl}/api/stripe/oauth-callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: redirectUri,
    state: user.sub,
  });

  const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  return { success: true, data: { url } };
}

// ═══════════════════════════════════════════════════════════════════════════
// TICKET ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Single ticket cancel ────────────────────────────────────────────────

export async function cancelTicketWithRefund(
  ticketId: string,
  reason: string,
  releaseToPool: boolean
): Promise<ActionResult<{ refundId: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!reason.trim()) return { success: false, error: 'A cancellation reason is required' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  // Fetch ticket with related data
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id, status, attendee_name, attendee_email, event_id, tier_id, order_id')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) return { success: false, error: 'Ticket not found' };
  if (ticket.status !== 'valid') return { success: false, error: `Cannot cancel a ticket with status "${ticket.status}"` };

  // Verify organizer owns this event
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, title, venue_name, city')
    .eq('id', ticket.event_id)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Not authorized to cancel this ticket' };
  }

  // Fetch first occurrence for email date
  const { data: cancelOcc } = await supabase
    .from('event_occurrences')
    .select('starts_at')
    .eq('event_id', ticket.event_id)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Fetch order for payment intent
  const { data: order } = await supabase
    .from('orders')
    .select('stripe_payment_intent_id, currency')
    .eq('id', ticket.order_id)
    .single();

  if (!order?.stripe_payment_intent_id) {
    return { success: false, error: 'No payment found for this ticket' };
  }

  // Fetch tier for unit price
  const { data: tier } = await supabase
    .from('ticket_tiers')
    .select('name, price, currency')
    .eq('id', ticket.tier_id)
    .single();

  if (!tier) return { success: false, error: 'Ticket tier not found' };

  const currency = tier.currency || order.currency || 'cad';
  const refundAmountStripe = toStripeAmount(tier.price, currency);

  // Create partial refund in Stripe
  let refundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: refundAmountStripe,
      reason: 'requested_by_customer',
      reverse_transfer: true,
      refund_application_fee: true,
    });
    refundId = refund.id;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stripe refund failed';
    console.error('Stripe refund error:', err);
    return { success: false, error: message };
  }

  const newStatus = releaseToPool ? 'refunded' : 'cancelled';

  const { error: updateError } = await supabase
    .from('tickets')
    .update({ status: newStatus })
    .eq('id', ticketId);

  if (updateError) {
    console.error('Failed to update ticket status after refund:', updateError);
    return { success: false, error: 'Refund processed but failed to update ticket status' };
  }

  // Restore inventory when releasing back to pool
  if (releaseToPool) {
    const { data: currentTier } = await supabase
      .from('ticket_tiers')
      .select('remaining_quantity')
      .eq('id', ticket.tier_id)
      .single();

    if (currentTier) {
      await supabase
        .from('ticket_tiers')
        .update({ remaining_quantity: currentTier.remaining_quantity + 1 })
        .eq('id', ticket.tier_id);
    }

    const { data: currentEvent } = await supabase
      .from('events')
      .select('total_tickets_sold')
      .eq('id', ticket.event_id)
      .single();

    if (currentEvent) {
      await supabase
        .from('events')
        .update({ total_tickets_sold: Math.max(0, currentEvent.total_tickets_sold - 1) })
        .eq('id', ticket.event_id);
    }
  }

  // Send cancellation email
  try {
    await sendTicketCancellationEmail({
      to: ticket.attendee_email,
      attendeeName: ticket.attendee_name,
      eventTitle: event.title,
      eventDate: cancelOcc?.starts_at || '',
      venueName: event.venue_name || '',
      city: event.city || '',
      tierName: tier.name,
      reason: reason.trim(),
      refundAmount: tier.price,
      currency,
    });
  } catch (emailErr) {
    console.error('Failed to send cancellation email:', emailErr);
  }

  return { success: true, data: { refundId } };
}

// ─── Full / partial order cancel ─────────────────────────────────────────

export async function cancelOrderWithRefund(
  orderId: string,
  reason: string,
  releaseToPool: boolean,
  ticketIds?: string[] // if provided, only cancel these tickets (partial); otherwise cancel all valid tickets
): Promise<ActionResult<{ refundedCount: number; totalRefund: number }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!reason.trim()) return { success: false, error: 'A cancellation reason is required' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  // Fetch order
  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, stripe_payment_intent_id, currency')
    .eq('id', orderId)
    .single();

  if (!order) return { success: false, error: 'Order not found' };
  if (!order.stripe_payment_intent_id) return { success: false, error: 'No payment found for this order' };

  // Verify organizer owns the event
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, title, venue_name, city')
    .eq('id', order.event_id)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Not authorized' };
  }

  // Fetch first occurrence for email date
  const { data: orderOcc } = await supabase
    .from('event_occurrences')
    .select('starts_at')
    .eq('event_id', order.event_id)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Fetch valid tickets for this order
  let query = supabase
    .from('tickets')
    .select('id, status, attendee_name, attendee_email, tier_id')
    .eq('order_id', orderId)
    .eq('status', 'valid');

  if (ticketIds && ticketIds.length > 0) {
    query = query.in('id', ticketIds);
  }

  const { data: ticketsToCancel } = await query;

  if (!ticketsToCancel || ticketsToCancel.length === 0) {
    return { success: false, error: 'No valid tickets to cancel in this order' };
  }

  // Fetch all relevant tiers in one query
  const tierIds = [...new Set(ticketsToCancel.map((t) => t.tier_id))];
  const { data: tiers } = await supabase
    .from('ticket_tiers')
    .select('id, name, price, currency')
    .in('id', tierIds);

  const tierMap = new Map((tiers || []).map((t) => [t.id, t]));

  // Calculate total refund amount
  let totalRefundDisplay = 0;
  let totalRefundStripe = 0;
  for (const t of ticketsToCancel) {
    const tier = tierMap.get(t.tier_id);
    if (tier) {
      const curr = tier.currency || order.currency || 'cad';
      totalRefundDisplay += tier.price;
      totalRefundStripe += toStripeAmount(tier.price, curr);
    }
  }

  // Issue single Stripe refund for total amount
  try {
    await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: totalRefundStripe,
      reason: 'requested_by_customer',
      reverse_transfer: true,
      refund_application_fee: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stripe refund failed';
    console.error('Stripe refund error:', err);
    return { success: false, error: message };
  }

  const newStatus = releaseToPool ? 'refunded' : 'cancelled';
  const cancelledIds = ticketsToCancel.map((t) => t.id);

  // Update all tickets
  const { error: updateError } = await supabase
    .from('tickets')
    .update({ status: newStatus })
    .in('id', cancelledIds);

  if (updateError) {
    console.error('Failed to update ticket statuses:', updateError);
    return { success: false, error: 'Refund processed but failed to update ticket statuses' };
  }

  // Restore inventory when releasing back to pool
  if (releaseToPool) {
    // Count tickets per tier to batch the increment
    const tierCounts = new Map<string, number>();
    for (const t of ticketsToCancel) {
      tierCounts.set(t.tier_id, (tierCounts.get(t.tier_id) || 0) + 1);
    }

    for (const [tierId, count] of tierCounts) {
      const { data: currentTier } = await supabase
        .from('ticket_tiers')
        .select('remaining_quantity')
        .eq('id', tierId)
        .single();

      if (currentTier) {
        await supabase
          .from('ticket_tiers')
          .update({ remaining_quantity: currentTier.remaining_quantity + count })
          .eq('id', tierId);
      }
    }

    const { data: currentEvent } = await supabase
      .from('events')
      .select('total_tickets_sold')
      .eq('id', event.id)
      .single();

    if (currentEvent) {
      await supabase
        .from('events')
        .update({ total_tickets_sold: Math.max(0, currentEvent.total_tickets_sold - ticketsToCancel.length) })
        .eq('id', event.id);
    }
  }

  // Send one cancellation email per unique attendee email
  const attendeeEmails = new Map<string, { name: string; tierNames: string[] }>();
  for (const t of ticketsToCancel) {
    const existing = attendeeEmails.get(t.attendee_email);
    const tierName = tierMap.get(t.tier_id)?.name || 'Unknown';
    if (existing) {
      existing.tierNames.push(tierName);
    } else {
      attendeeEmails.set(t.attendee_email, { name: t.attendee_name, tierNames: [tierName] });
    }
  }

  const currency = order.currency || 'cad';
  for (const [email, { name, tierNames }] of attendeeEmails) {
    // Calculate refund for this attendee's tickets
    const attendeeTickets = ticketsToCancel.filter((t) => t.attendee_email === email);
    let attendeeRefund = 0;
    for (const t of attendeeTickets) {
      const tier = tierMap.get(t.tier_id);
      if (tier) attendeeRefund += tier.price;
    }

    try {
      await sendTicketCancellationEmail({
        to: email,
        attendeeName: name,
        eventTitle: event.title,
        eventDate: orderOcc?.starts_at || '',
        venueName: event.venue_name || '',
        city: event.city || '',
        tierName: tierNames.join(', '),
        reason: reason.trim(),
        refundAmount: attendeeRefund,
        currency,
      });
    } catch (emailErr) {
      console.error('Failed to send cancellation email to', email, emailErr);
    }
  }

  return { success: true, data: { refundedCount: ticketsToCancel.length, totalRefund: totalRefundDisplay } };
}

// ═══════════════════════════════════════════════════════════════════════════
// MANUAL TICKET ISSUANCE
// ═══════════════════════════════════════════════════════════════════════════

export async function issueTicketsManually(input: {
  eventId: string;
  tierId: string;
  quantity: number;
  attendeeName: string;
  attendeeEmail: string;
  reason: string;
  isFree: boolean;
}): Promise<ActionResult<{ orderId: string; ticketIds: string[] }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  // Verify organizer owns the event
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, title, currency')
    .eq('id', input.eventId)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Event not found or not authorized' };
  }

  // Verify tier belongs to event and has enough remaining quantity
  const { data: tier } = await supabase
    .from('ticket_tiers')
    .select('id, name, price, currency, remaining_quantity')
    .eq('id', input.tierId)
    .eq('event_id', input.eventId)
    .single();

  if (!tier) return { success: false, error: 'Ticket tier not found for this event' };

  if (tier.remaining_quantity < input.quantity) {
    return { success: false, error: `Only ${tier.remaining_quantity} tickets remaining in "${tier.name}"` };
  }

  const unitPrice = input.isFree ? 0 : Number(tier.price);
  const totalAmount = unitPrice * input.quantity;
  const currency = tier.currency || event.currency || 'cad';

  // Create a manual order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: null,
      event_id: input.eventId,
      stripe_payment_intent_id: null,
      stripe_checkout_session_id: null,
      total_amount: totalAmount,
      platform_fee_amount: 0,
      organizer_payout_amount: totalAmount,
      currency,
      buyer_email: input.attendeeEmail,
      buyer_name: input.attendeeName,
      status: 'completed',
      source_app: 'organizer',
      notes: `Manual issuance: ${input.reason}`,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    console.error('Manual order creation error:', orderError);
    return { success: false, error: orderError?.message || 'Failed to create order' };
  }

  // Create order item
  await supabase.from('order_items').insert({
    order_id: order.id,
    tier_id: input.tierId,
    quantity: input.quantity,
    unit_price: unitPrice,
    subtotal: totalAmount,
  });

  // Create tickets — the DB trigger handles inventory decrement
  const ticketInserts = Array.from({ length: input.quantity }, () => ({
    event_id: input.eventId,
    tier_id: input.tierId,
    order_id: order.id,
    user_id: null,
    attendee_name: input.attendeeName,
    attendee_email: input.attendeeEmail,
    status: 'valid' as const,
    issued_by: user.sub,
    issue_reason: input.reason,
  }));

  const { data: tickets, error: ticketError } = await supabase
    .from('tickets')
    .insert(ticketInserts)
    .select('id');

  if (ticketError || !tickets) {
    console.error('Manual ticket creation error:', ticketError);
    return { success: false, error: ticketError?.message || 'Failed to create tickets' };
  }

  return { success: true, data: { orderId: order.id, ticketIds: tickets.map((t) => t.id) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// REISSUE TICKET
// ═══════════════════════════════════════════════════════════════════════════

export async function reissueTicket(input: {
  orderId: string;
  oldTicketId: string;
  newAttendeeName: string;
  newAttendeeEmail: string;
  reason: string;
}): Promise<ActionResult<{ newTicketId: string }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  // Fetch old ticket
  const { data: oldTicket } = await supabase
    .from('tickets')
    .select('id, status, event_id, tier_id, order_id, attendee_name, attendee_email')
    .eq('id', input.oldTicketId)
    .eq('order_id', input.orderId)
    .single();

  if (!oldTicket) return { success: false, error: 'Ticket not found on this order' };
  if (oldTicket.status !== 'valid') return { success: false, error: `Cannot reissue a ticket with status "${oldTicket.status}"` };

  // Verify organizer owns the event
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, total_tickets_sold')
    .eq('id', oldTicket.event_id)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    return { success: false, error: 'Not authorized' };
  }

  // Cancel old ticket
  const { error: cancelError } = await supabase
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('id', input.oldTicketId);

  if (cancelError) return { success: false, error: 'Failed to cancel old ticket' };

  // Restore inventory (the new ticket trigger will decrement it again — net zero)
  const { data: currentTier } = await supabase
    .from('ticket_tiers')
    .select('remaining_quantity')
    .eq('id', oldTicket.tier_id)
    .single();

  if (currentTier) {
    await supabase
      .from('ticket_tiers')
      .update({ remaining_quantity: currentTier.remaining_quantity + 1 })
      .eq('id', oldTicket.tier_id);
  }

  await supabase
    .from('events')
    .update({ total_tickets_sold: Math.max(0, event.total_tickets_sold - 1) })
    .eq('id', oldTicket.event_id);

  // Create new ticket on same order, same tier
  const { data: newTicket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      event_id: oldTicket.event_id,
      tier_id: oldTicket.tier_id,
      order_id: oldTicket.order_id,
      user_id: null,
      attendee_name: input.newAttendeeName,
      attendee_email: input.newAttendeeEmail,
      status: 'valid',
      issued_by: user.sub,
      issue_reason: `Reissue: ${input.reason}`,
      original_ticket_id: input.oldTicketId,
    })
    .select('id')
    .single();

  if (ticketError || !newTicket) {
    console.error('Reissue ticket creation error:', ticketError);
    return { success: false, error: ticketError?.message || 'Failed to create new ticket' };
  }

  // Add note to order
  const { data: order } = await supabase
    .from('orders')
    .select('notes')
    .eq('id', input.orderId)
    .single();

  const existingNotes = order?.notes || '';
  const newNote = `Reissued ticket ${input.oldTicketId.slice(0, 8)} → ${newTicket.id.slice(0, 8)}: ${input.reason}`;
  await supabase
    .from('orders')
    .update({ notes: existingNotes ? `${existingNotes}\n${newNote}` : newNote })
    .eq('id', input.orderId);

  return { success: true, data: { newTicketId: newTicket.id } };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEND TICKETS TO EMAIL
// ═══════════════════════════════════════════════════════════════════════════

export async function sendTicketsToEmail(input: {
  ticketIds: string[];
  recipientEmail: string;
  recipientName: string;
}): Promise<ActionResult<{ sent: number }>> {
  const user = await getAuthUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!input.ticketIds.length) return { success: false, error: 'No tickets selected' };

  const effectiveOrgId = await getEffectiveOrganizerId();
  const supabase = getSupabaseAdmin();

  // Fetch tickets with event/tier info
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, qr_code_secret, event_id, tier_id, status')
    .in('id', input.ticketIds);

  if (!tickets || tickets.length === 0) {
    return { success: false, error: 'Tickets not found' };
  }

  // Only send valid tickets
  const validTickets = tickets.filter((t) => t.status === 'valid');
  if (validTickets.length === 0) {
    return { success: false, error: 'No valid tickets to send' };
  }

  // Verify organizer owns the event(s)
  const eventIds = [...new Set(validTickets.map((t) => t.event_id))];
  const { data: events } = await supabase
    .from('events')
    .select('id, organizer_id, title, venue_name, city, currency')
    .in('id', eventIds);

  if (!events || events.length === 0) {
    return { success: false, error: 'Event not found' };
  }

  for (const ev of events) {
    if (ev.organizer_id !== effectiveOrgId) {
      return { success: false, error: 'Not authorized to send tickets for this event' };
    }
  }

  // Fetch tier names
  const tierIds = [...new Set(validTickets.map((t) => t.tier_id))];
  const { data: tiers } = await supabase
    .from('ticket_tiers')
    .select('id, name')
    .in('id', tierIds);
  const tierMap = new Map((tiers || []).map((t) => [t.id, t.name]));

  // Build ticket info for email
  const event = events[0]; // All tickets should be for the same event

  // Fetch first occurrence for email
  const { data: emailOcc } = await supabase
    .from('event_occurrences')
    .select('starts_at, ends_at')
    .eq('event_id', event.id)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const ticketInfos = validTickets.map((t) => ({
    id: t.id,
    qr_code_secret: t.qr_code_secret,
    tierName: tierMap.get(t.tier_id) || 'Unknown',
  }));

  try {
    await sendTicketEmail({
      to: input.recipientEmail,
      attendeeName: input.recipientName,
      tickets: ticketInfos,
      eventTitle: event.title,
      eventDate: emailOcc?.starts_at || '',
      eventEndDate: emailOcc?.ends_at || undefined,
      venueName: event.venue_name || '',
      city: event.city || '',
      currency: event.currency || 'cad',
    });
  } catch (err) {
    console.error('Failed to send ticket email:', err);
    const message = err instanceof Error ? err.message : 'Failed to send email';
    return { success: false, error: message };
  }

  return { success: true, data: { sent: validTickets.length } };
}
