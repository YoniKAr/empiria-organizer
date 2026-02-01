import { auth0 } from '@/lib/auth0';
import { createClient } from '@supabase/supabase-js';

export default async function PaymentsPage() {
  const session = await auth0.getSession();
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  
  // Check if they have connected Stripe
  const { data: user } = await supabase
    .from('users')
    .select('stripe_onboarding_completed')
    .eq('auth0_id', session?.user.sub)
    .single();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Payments & Payouts</h1>
      
      {!user?.stripe_onboarding_completed ? (
          <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl mb-8">
            <h2 className="font-bold text-orange-800 text-lg mb-2">Connect with Stripe</h2>
            <p className="text-orange-700 text-sm mb-4">
                To sell tickets and receive payouts, you must connect a Stripe account.
            </p>
            <button className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-700 transition-colors">
                Setup Payouts
            </button>
          </div>
      ) : (
          <div className="bg-green-50 border border-green-200 p-6 rounded-xl mb-8">
             <h2 className="font-bold text-green-800 text-lg">Stripe Connected ✅</h2>
             <p className="text-green-700 text-sm">Your payouts are active.</p>
          </div>
      )}

      <h2 className="text-lg font-bold mb-4">Transaction History</h2>
      <div className="bg-white rounded-xl border border-gray-200 h-40 flex items-center justify-center text-gray-400 text-sm">
        No transactions yet
      </div>
    </div>
  );
}
