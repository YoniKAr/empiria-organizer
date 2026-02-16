'use client';

import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { createStripeConnectLink } from '@/lib/actions';

export default function StripeConnectButton({ isConnected = false }: { isConnected?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const result = await createStripeConnectLink();
      if (!result.success) throw new Error(result.error);

      // Redirect to Stripe onboarding or dashboard
      window.location.href = result.data.url;
    } catch (err) {
      console.error('Stripe connect error:', err);
      setLoading(false);
    }
  };

  if (isConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
        Stripe Dashboard
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Connecting...
        </>
      ) : (
        'Setup Payouts'
      )}
    </button>
  );
}
