import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Ticket, CalendarDays, Eye, ArrowRight } from 'lucide-react';

export default async function DashboardHome() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=/dashboard');

  const supabase = getSupabaseAdmin();
  const orgId = session.user.sub; // 

  // Fetch profile + all organizer data in parallel
  const [profileRes, eventsRes, ordersRes, ticketsRes] = await Promise.all([
    supabase
      .from('users')
      .select('default_currency')
      .eq('auth0_id', orgId)
      .single(),

    supabase
      .from('events')
      .select('id, title, slug, status, start_at, total_tickets_sold, total_capacity, created_at')
      .eq('organizer_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabase
      .from('orders')
      .select('id, total_amount, organizer_payout_amount, status, created_at, events!inner(organizer_id)')
      .eq('events.organizer_id', orgId)
      .eq('status', 'completed'),

    supabase
      .from('tickets')
      .select('id, status, purchase_date, events!inner(organizer_id)')
      .eq('events.organizer_id', orgId),
  ]);

  const events = eventsRes.data || [];
  const orders = ordersRes.data || [];
  const tickets = ticketsRes.data || [];
  const currency = profileRes.data?.default_currency || 'cad';

  // Calculate stats
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.organizer_payout_amount), 0);
  const totalTicketsSold = tickets.filter((t) => t.status === 'valid' || t.status === 'used').length;
  const activeEvents = events.filter((e) => e.status === 'published').length;
  const draftEvents = events.filter((e) => e.status === 'draft').length;

  // Recent events (last 5)
  const recentEvents = events.slice(0, 5);

  // Revenue this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const revenueThisMonth = orders
    .filter((o) => o.created_at >= monthStart)
    .reduce((sum, o) => sum + Number(o.organizer_payout_amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#F98C1F]">Organizer Overview</h1>
        <Link
          href="/dashboard/events/create"
          className="flex items-center gap-2 bg-[#F98C1F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          + Create Event
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue, currency)}
          sub={revenueThisMonth > 0 ? `${formatCurrency(revenueThisMonth, currency)} this month` : 'No revenue this month'}
          icon={<TrendingUp size={18} />}
          color="green"
        />
        <StatCard
          label="Tickets Sold"
          value={totalTicketsSold.toLocaleString()}
          sub={`Across ${events.length} event${events.length !== 1 ? 's' : ''}`}
          icon={<Ticket size={18} />}
          color="blue"
        />
        <StatCard
          label="Active Events"
          value={activeEvents.toString()}
          sub={draftEvents > 0 ? `${draftEvents} draft${draftEvents !== 1 ? 's' : ''}` : 'No drafts'}
          icon={<CalendarDays size={18} />}
          color="orange"
        />
        <StatCard
          label="Total Orders"
          value={orders.length.toLocaleString()}
          sub="Completed payments"
          icon={<Eye size={18} />}
          color="purple"
        />
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Events</h2>
          {events.length > 5 && (
            <Link href="/dashboard/events" className="text-sm text-gray-500 hover:text-black flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 mb-3">No events yet</p>
            <Link href="/dashboard/events/create" className="text-orange-600 text-sm font-medium hover:underline">
              Create your first event
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <StatusBadge status={event.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {event.start_at
                        ? new Date(event.start_at).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                        : 'No date set'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-medium text-gray-900">
                    {event.total_tickets_sold}/{event.total_capacity || '∞'}
                  </p>
                  <p className="text-xs text-gray-500">tickets sold</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-500 text-sm font-medium">{label}</span>
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    published: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-600',
  };

  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}
