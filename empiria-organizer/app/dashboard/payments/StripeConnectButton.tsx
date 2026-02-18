'use client';

import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { createStripeConnectLink, createStripeStandardConnectLink } from '@/lib/actions';

interface StripeConnectButtonProps {
  isConnected?: boolean;
  accountType?: string | null;
}

export default function StripeConnectButton({
  isConnected = false,
  accountType,
}: StripeConnectButtonProps) {
  const [loadingExpress, setLoadingExpress] = useState(false);
  const [loadingStandard, setLoadingStandard] = useState(false);

  const handleExpressConnect = async () => {
    setLoadingExpress(true);
    try {
      const result = await createStripeConnectLink();
      if (!result.success) throw new Error(result.error);
      window.location.href = result.data.url;
    } catch (err) {
      console.error('Stripe connect error:', err);
      setLoadingExpress(false);
    }
  };

  const handleStandardConnect = async () => {
    setLoadingStandard(true);
    try {
      const result = await createStripeStandardConnectLink();
      if (!result.success) throw new Error(result.error);
      window.location.href = result.data.url;
    } catch (err) {
      console.error('Stripe OAuth error:', err);
      setLoadingStandard(false);
    }
  };

  if (isConnected) {
    return (
      <button
        onClick={handleExpressConnect}
        disabled={loadingExpress}
        className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50"
      >
        {loadingExpress ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
        Stripe Dashboard
      </button>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        onClick={handleExpressConnect}
        disabled={loadingExpress || loadingStandard}
        className="flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
      >
        {loadingExpress ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Creating...
          </>
        ) : (
          'Create New Stripe Account'
        )}
      </button>
      <button
        onClick={handleStandardConnect}
        disabled={loadingExpress || loadingStandard}
        className="flex items-center justify-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg font-medium text-sm hover:bg-orange-50 transition-colors disabled:opacity-50"
      >
        {loadingStandard ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Connecting...
          </>
        ) : (
          'Connect Existing Stripe Account'
        )}
      </button>
    </div>
  );
}
