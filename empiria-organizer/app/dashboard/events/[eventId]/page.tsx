import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveOrganizerId } from '@/lib/admin-perspective';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, MapPin, Users } from 'lucide-react';
import { TicketTable } from './TicketTable';
import { EventActions } from './EventActions';
import { IssueTicketsModal } from './IssueTicketsModal';

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?screen_hint=signup&returnTo=/dashboard/events');

  const supabase = getSupabaseAdmin();
  const effectiveOrgId = await getEffectiveOrganizerId();

  // Fetch event + verify ownership
  const { data: event } = await supabase
    .from('events')
    .select(`
      id, title, slug, status,
      venue_name, city, location_type,
      total_capacity, total_tickets_sold,
      cover_image_url, currency, organizer_id
    `)
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    redirect('/dashboard/events');
  }

  // Fetch occurrences for this event
  const { data: occurrences } = await supabase
    .from('event_occurrences')
    .select('id, starts_at, ends_at, label, is_cancelled')
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true });

  // Fetch ticket tiers for this event
  const { data: tiers } = await supabase
    .from('ticket_tiers')
    .select('id, name, price, currency, remaining_quantity')
    .eq('event_id', eventId)
    .order('price', { ascending: true });

  // Fetch all tickets for this event with tier + order info
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select(`
      id, order_id, status, attendee_name, attendee_email, purchase_date,
      ticket_tiers(name, price, currency),
      orders(id, stripe_payment_intent_id, currency)
    `)
    .eq('event_id', eventId)
    .order('purchase_date', { ascending: false });

  if (ticketsError) {
    console.error('Failed to fetch tickets:', ticketsError);
  }

  const allTickets = (tickets || []).map((t: Record<string, unknown>) => {
    const tier = t.ticket_tiers as { name: string; price: number; currency: string } | null;
    const order = t.orders as { id: string; stripe_payment_intent_id: string; currency: string } | null;
    return {
      id: t.id as string,
      order_id: (t.order_id as string) || '',
      status: t.status as string,
      attendee_name: t.attendee_name as string,
      attendee_email: t.attendee_email as string,
      created_at: t.purchase_date as string,
      tier_name: tier?.name || 'Unknown',
      tier_price: tier?.price || 0,
      currency: tier?.currency || order?.currency || event.currency || 'cad',
    };
  });

  // Fetch revenue splits for this event
  const { data: revenueSplits } = await supabase
    .from('revenue_splits')
    .select('id, recipient_user_id, recipient_stripe_id, percentage, source_type, description')
    .eq('event_id', eventId)
    .order('percentage', { ascending: false });

  // If there are splits, fetch the user names
  let splitsWithNames: Array<{
    id: string;
    percentage: number;
    description: string | null;
    recipientName: string;
    recipientEmail: string;
  }> = [];

  if (revenueSplits && revenueSplits.length > 0) {
    const userIds = revenueSplits.map((s) => s.recipient_user_id);
    const { data: splitUsers } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds);

    const userMap = new Map((splitUsers || []).map((u) => [u.id, u]));

    splitsWithNames = revenueSplits.map((s) => {
      const user = userMap.get(s.recipient_user_id);
      return {
        id: s.id,
        percentage: s.percentage,
        description: s.description,
        recipientName: user?.full_name || 'Unknown',
        recipientEmail: user?.email || '',
      };
    });
  }

  const tierOptions = (tiers || []).map((t) => ({
    id: t.id,
    name: t.name,
    price: Number(t.price),
    currency: t.currency || event.currency || 'cad',
    remaining: t.remaining_quantity,
  }));

  const firstOcc = occurrences?.[0];
  const startDate = firstOcc ? new Date(firstOcc.starts_at) : null;
  const venue = [event.venue_name, event.city].filter(Boolean).join(', ');

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    published: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/events"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Back to Events
      </Link>

      {/* Event Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${statusColors[event.status] || statusColors.draft}`}>
                {event.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {startDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {startDate.toLocaleDateString('en-CA', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
              {venue && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {venue}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users size={14} />
                {event.total_tickets_sold}/{event.total_capacity || '\u221E'} sold
              </span>
            </div>
          </div>

          {event.status === 'published' && event.slug && (
            <a
              href={`https://shop.empiriaindia.com/events/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-600 hover:underline flex-shrink-0"
            >
              View live page &rarr;
            </a>
          )}
        </div>

        {/* Management Actions */}
        <div className="border-t border-gray-100 pt-4">
          <EventActions
            eventId={event.id}
            status={event.status}
            hasTicketsSold={allTickets.length > 0}
          />
        </div>
      </div>

      {/* Revenue Splits Section */}
      {splitsWithNames.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Revenue Splits
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Organizer</th>
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Email</th>
                  <th className="text-right py-2 pr-4 text-gray-500 font-medium">Percentage</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {splitsWithNames.map((split) => (
                  <tr key={split.id} className="border-b border-gray-50">
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{split.recipientName}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{split.recipientEmail}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-gray-900 tabular-nums">{split.percentage}%</td>
                    <td className="py-2.5 text-gray-500">{split.description || '\u2014'}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">You (Primary)</td>
                  <td className="py-2.5 pr-4 text-gray-500">\u2014</td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-gray-900 tabular-nums">
                    {100 - splitsWithNames.reduce((sum, s) => sum + s.percentage, 0)}%
                  </td>
                  <td className="py-2.5 text-gray-500">Primary organizer</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tickets Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Tickets ({allTickets.length})
          </h2>
          {tierOptions.length > 0 && (
            <IssueTicketsModal eventId={event.id} tiers={tierOptions} />
          )}
        </div>

        {allTickets.length === 0 ? (
          <p className="text-center py-12 text-gray-400">No tickets issued yet.</p>
        ) : (
          <TicketTable tickets={allTickets} />
        )}
      </div>
    </div>
  );
}
