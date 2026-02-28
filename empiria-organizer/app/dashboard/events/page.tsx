import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveOrganizerId } from '@/lib/admin-perspective';
import { formatCurrency } from '@/lib/utils';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MapPin, Users, Pencil, Eye } from 'lucide-react';

export default async function EventsList() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=/dashboard/events');

  const supabase = getSupabaseAdmin();
  const effectiveOrgId = await getEffectiveOrganizerId();

  const { data: events } = await supabase
    .from('events')
    .select(`
      id, title, slug, status, start_at, end_at,
      venue_name, city, location_type,
      total_capacity, total_tickets_sold,
      cover_image_url, currency, created_at,
      ticket_tiers(id, name, price, initial_quantity, remaining_quantity)
    `)
    .eq('organizer_id', effectiveOrgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const allEvents = events || [];
  const published = allEvents.filter((e) => e.status === 'published');
  const drafts = allEvents.filter((e) => e.status === 'draft');
  const past = allEvents.filter((e) => e.status === 'completed' || e.status === 'cancelled');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F98C1F]">My Events</h1>
          <p className="text-sm text-gray-500 mt-1">{allEvents.length} event{allEvents.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/dashboard/events/create"
          className="bg-[#F98C1F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-[#e07b10] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
          + Create Event
        </Link>
      </div>

      {allEvents.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={20} className="text-gray-400" />
          </div>
          <p className="text-gray-500 mb-4">You haven&apos;t created any events yet.</p>
          <Link href="/dashboard/events/create" className="text-orange-600 font-medium hover:underline">
            Create your first event
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Published Events */}
          {published.length > 0 && (
            <EventSection title="Live Events" count={published.length} events={published} />
          )}

          {/* Drafts */}
          {drafts.length > 0 && (
            <EventSection title="Drafts" count={drafts.length} events={drafts} />
          )}

          {/* Past / Cancelled */}
          {past.length > 0 && (
            <EventSection title="Past & Cancelled" count={past.length} events={past} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface EventWithTiers {
  id: string;
  title: string;
  slug: string;
  status: string;
  start_at: string;
  end_at: string;
  venue_name: string | null;
  city: string | null;
  location_type: string;
  total_capacity: number;
  total_tickets_sold: number;
  cover_image_url: string | null;
  currency: string;
  created_at: string;
  ticket_tiers: {
    id: string;
    name: string;
    price: number;
    initial_quantity: number;
    remaining_quantity: number;
  }[];
}

function EventSection({
  title,
  count,
  events,
}: {
  title: string;
  count: number;
  events: EventWithTiers[];
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
        {title} ({count})
      </h2>
      <div className="space-y-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventWithTiers }) {
  const startDate = event.start_at ? new Date(event.start_at) : null;
  const soldPercent =
    event.total_capacity > 0
      ? Math.round((event.total_tickets_sold / event.total_capacity) * 100)
      : 0;
  const lowestPrice = event.ticket_tiers.length > 0
    ? Math.min(...event.ticket_tiers.map((t) => Number(t.price)))
    : null;
  const totalRemaining = event.ticket_tiers.reduce((sum, t) => sum + t.remaining_quantity, 0);

  // All events → detail page (management hub)
  const cardHref = `/dashboard/events/${event.id}`;

  return (
    <Link href={cardHref} className="block">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-[#F98C1F] transition-colors">
        <div className="flex">
          {/* Cover Image or Placeholder */}
          <div className="w-40 h-32 flex-shrink-0 bg-gray-100 relative hidden sm:block">
            {event.cover_image_url ? (
              <img
                src={event.cover_image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Calendar size={24} className="text-gray-300" />
              </div>
            )}
            <StatusBadge status={event.status} />
          </div>

          {/* Content */}
          <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900 truncate">{event.title}</h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {event.status === 'draft' && (
                    <span
                      className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </span>
                  )}
                  {event.status === 'published' && (
                    <a
                      href={`https://shop.empiriaindia.com/events/${event.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded"
                      title="View live page"
                    >
                      <Eye size={14} />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                {startDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {startDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {(event.venue_name || event.city) && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {[event.venue_name, event.city].filter(Boolean).join(', ')}
                  </span>
                )}
                {event.ticket_tiers.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {event.total_tickets_sold}/{event.total_capacity || '∞'} sold
                  </span>
                )}
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                {lowestPrice !== null && (
                  <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                    {lowestPrice === 0 ? 'Free' : `From ${formatCurrency(lowestPrice, event.currency)}`}
                  </span>
                )}
                {event.ticket_tiers.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {event.ticket_tiers.length} tier{event.ticket_tiers.length !== 1 ? 's' : ''}
                    {' · '}
                    {totalRemaining} remaining
                  </span>
                )}
              </div>

              {/* Capacity bar */}
              {event.total_capacity > 0 && event.status === 'published' && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${soldPercent >= 90 ? 'bg-red-500' : soldPercent >= 60 ? 'bg-orange-400' : 'bg-green-500'
                        }`}
                      style={{ width: `${Math.min(soldPercent, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">{soldPercent}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-800/70 text-gray-100',
    published: 'bg-green-600/80 text-white',
    cancelled: 'bg-red-600/80 text-white',
    completed: 'bg-blue-600/80 text-white',
  };

  return (
    <span
      className={`absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${styles[status] || styles.draft
        }`}
    >
      {status}
    </span>
  );
}
