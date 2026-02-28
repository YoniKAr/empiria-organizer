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
  if (!session?.user) redirect('/auth/login?returnTo=/dashboard/events');

  const supabase = getSupabaseAdmin();
  const effectiveOrgId = await getEffectiveOrganizerId();

  // Fetch event + verify ownership
  const { data: event } = await supabase
    .from('events')
    .select(`
      id, title, slug, status, start_at, end_at,
      venue_name, city, location_type,
      total_capacity, total_tickets_sold,
      cover_image_url, currency, organizer_id
    `)
    .eq('id', eventId)
    .single();

  if (!event || event.organizer_id !== effectiveOrgId) {
    redirect('/dashboard/events');
  }

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

  const tierOptions = (tiers || []).map((t) => ({
    id: t.id,
    name: t.name,
    price: Number(t.price),
    currency: t.currency || event.currency || 'cad',
    remaining: t.remaining_quantity,
  }));

  const startDate = event.start_at ? new Date(event.start_at) : null;
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
