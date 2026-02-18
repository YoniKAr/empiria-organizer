'use client';

import { useState, useTransition } from 'react';
import { cancelTicketWithRefund } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

interface Ticket {
  id: string;
  status: string;
  attendee_name: string;
  attendee_email: string;
  created_at: string;
  tier_name: string;
  tier_price: number;
  currency: string;
}

const statusStyles: Record<string, string> = {
  valid: 'bg-green-100 text-green-700',
  used: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [releaseToPool, setReleaseToPool] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function openModal(ticketId: string) {
    setCancellingId(ticketId);
    setReason('');
    setReleaseToPool(false);
    setFeedback(null);
  }

  function closeModal() {
    setCancellingId(null);
    setReason('');
    setReleaseToPool(false);
    setFeedback(null);
  }

  function handleConfirm() {
    if (!cancellingId || !reason.trim()) return;

    startTransition(async () => {
      const result = await cancelTicketWithRefund(cancellingId, reason, releaseToPool);
      if (result.success) {
        const msg = releaseToPool
          ? 'Ticket cancelled, refund issued, and slot released back to pool.'
          : 'Ticket cancelled and refund issued.';
        setFeedback({ type: 'success', message: msg });
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 1500);
      } else {
        setFeedback({ type: 'error', message: result.error });
      }
    });
  }

  const cancellingTicket = cancellingId
    ? tickets.find((t) => t.id === cancellingId)
    : null;

  return (
    <>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="pb-3 pr-4">Attendee</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Tier</th>
              <th className="pb-3 pr-4">Price</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Purchased</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-100 last:border-0">
                <td className="py-3 pr-4 font-medium text-gray-900">
                  {ticket.attendee_name}
                </td>
                <td className="py-3 pr-4 text-gray-500">
                  {ticket.attendee_email}
                </td>
                <td className="py-3 pr-4 text-gray-700">
                  {ticket.tier_name}
                </td>
                <td className="py-3 pr-4 text-gray-700">
                  {ticket.tier_price === 0
                    ? 'Free'
                    : formatCurrency(ticket.tier_price, ticket.currency)}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-block text-xs font-bold uppercase px-2 py-0.5 rounded ${
                      statusStyles[ticket.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {ticket.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-500">
                  {new Date(ticket.created_at).toLocaleDateString('en-CA', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="py-3">
                  {ticket.status === 'valid' && ticket.tier_price > 0 && (
                    <button
                      onClick={() => openModal(ticket.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                    >
                      Cancel &amp; Refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cancel Modal */}
      {cancellingId && cancellingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cancel &amp; Refund Ticket</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will refund{' '}
              <span className="font-medium text-gray-700">
                {formatCurrency(cancellingTicket.tier_price, cancellingTicket.currency)}
              </span>{' '}
              to <span className="font-medium text-gray-700">{cancellingTicket.attendee_name}</span> and
              notify them via email.
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for cancellation
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              placeholder="e.g. Event rescheduled, duplicate purchase, etc."
            />

            {/* Pool option */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">What happens to this ticket slot?</p>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-black has-[:checked]:bg-gray-50">
                <input
                  type="radio"
                  name="poolOption"
                  checked={!releaseToPool}
                  onChange={() => setReleaseToPool(false)}
                  className="mt-0.5 accent-black"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Keep cancelled</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ticket stays on record as cancelled. Total capacity is reduced permanently.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-black has-[:checked]:bg-gray-50">
                <input
                  type="radio"
                  name="poolOption"
                  checked={releaseToPool}
                  onChange={() => setReleaseToPool(true)}
                  className="mt-0.5 accent-black"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Release back to pool</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ticket is removed and the slot becomes available for someone else to purchase.
                  </p>
                </div>
              </label>
            </div>

            {feedback && (
              <p
                className={`mt-3 text-sm font-medium ${
                  feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {feedback.message}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeModal}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending || !reason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {isPending ? 'Processing…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
