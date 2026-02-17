import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import StripeConnectButton from './StripeConnectButton';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string; error?: string; reason?: string }>;
}) {
  const session = await auth0.getSession();
  const supabase = getSupabaseAdmin();
  const params = await searchParams;

  const { data: user } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_onboarding_completed, default_currency')
    .eq('auth0_id', session?.user.sub)
    .single();

  const currency = user?.default_currency || 'cad';

  // Fetch recent orders for this organizer's events
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, total_amount, platform_fee_amount, organizer_payout_amount,
      currency, status, created_at,
      events!inner(title, organizer_id)
    `)
    .eq('events.organizer_id', session?.user.sub)
    .order('created_at', { ascending: false })
    .limit(20);

  const totalRevenue = (orders || [])
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + Number(o.organizer_payout_amount), 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Payments & Payouts</h1>

      {/* Status Messages */}
      {params.reason === 'stripe_required' && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-6 text-sm text-orange-800">
          👋 You need to connect your Stripe account before creating events.
          This lets us process ticket payments and send you payouts.
        </div>
      )}
      {params.stripe === 'success' && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6 text-sm text-green-800">
          ✅ Stripe account connected successfully! You can now receive payouts.
        </div>
      )}
      {params.stripe === 'incomplete' && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6 text-sm text-yellow-800">
          ⚠️ Stripe onboarding is not complete. Please finish setting up your account.
        </div>
      )}
      {params.error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6 text-sm text-red-800">
          Something went wrong connecting your Stripe account. Please try again.
        </div>
      )}

      {/* Stripe Connection Status */}
      {!user?.stripe_onboarding_completed ? (
        <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl mb-8">
          <h2 className="font-bold text-orange-800 text-lg mb-2">Connect with Stripe</h2>
          <p className="text-orange-700 text-sm mb-4">
            To sell tickets and receive payouts, you must connect a Stripe account.
            We use Stripe Express for fast, secure onboarding.
          </p>
          <StripeConnectButton />
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 p-6 rounded-xl mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-green-800 text-lg">Stripe Connected ✅</h2>
              <p className="text-green-700 text-sm">Your payouts are active.</p>
            </div>
            <StripeConnectButton isConnected />
          </div>
          {totalRevenue > 0 && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <p className="text-sm text-green-700">
                Total earnings: <span className="font-bold">{formatCurrency(totalRevenue, currency)}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      <h2 className="text-lg font-bold mb-4">Transaction History</h2>
      {!orders || orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 h-40 flex items-center justify-center text-gray-400 text-sm">
          No transactions yet
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Event</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Your Payout</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900 max-w-[200px] truncate">
                    {(order.events as unknown as { title: string }[])?.[0]?.title || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {formatCurrency(Number(order.total_amount), order.currency || currency)}
                  </td>
                  <td className="py-3 px-4 font-medium text-green-700">
                    {formatCurrency(Number(order.organizer_payout_amount), order.currency || currency)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('en-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
