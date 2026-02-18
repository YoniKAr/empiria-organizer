'use client';

import { useState, useTransition } from 'react';
import { cancelTicketWithRefund, cancelOrderWithRefund } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';

interface Ticket {
  id: string;
  order_id: string;
  status: string;
  attendee_name: string;
  attendee_email: string;
  created_at: string;
  tier_name: string;
  tier_price: number;
  currency: string;
}

interface OrderGroup {
  order_id: string;
  tickets: Ticket[];
  totalPrice: number;
  currency: string;
  purchaseDate: string;
  hasValidTickets: boolean;
  validCount: number;
}

const statusStyles: Record<string, string> = {
  valid: 'bg-green-100 text-green-700',
  used: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-orange-100 text-orange-700',
};

function groupByOrder(tickets: Ticket[]): OrderGroup[] {
  const map = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const key = t.order_id || t.id; // fallback to ticket id if no order
    const group = map.get(key) || [];
    group.push(t);
    map.set(key, group);
  }

  return Array.from(map.entries()).map(([order_id, tickets]) => ({
    order_id,
    tickets,
    totalPrice: tickets.reduce((sum, t) => sum + t.tier_price, 0),
    currency: tickets[0].currency,
    purchaseDate: tickets[0].created_at,
    hasValidTickets: tickets.some((t) => t.status === 'valid' && t.tier_price > 0),
    validCount: tickets.filter((t) => t.status === 'valid').length,
  }));
}

type CancelMode = 'ticket' | 'order';

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const [cancelTarget, setCancelTarget] = useState<{ mode: CancelMode; ticketId?: string; orderId?: string } | null>(null);
  const [reason, setReason] = useState('');
  const [releaseToPool, setReleaseToPool] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const orderGroups = groupByOrder(tickets);

  function openTicketModal(ticketId: string) {
    setCancelTarget({ mode: 'ticket', ticketId });
    setReason('');
    setReleaseToPool(false);
    setFeedback(null);
  }

  function openOrderModal(orderId: string) {
    setCancelTarget({ mode: 'order', orderId });
    setReason('');
    setReleaseToPool(false);
    setFeedback(null);
  }

  function closeModal() {
    setCancelTarget(null);
    setReason('');
    setReleaseToPool(false);
    setFeedback(null);
  }

  function handleConfirm() {
    if (!cancelTarget || !reason.trim()) return;

    startTransition(async () => {
      let success = false;
      let errorMsg = '';

      if (cancelTarget.mode === 'ticket' && cancelTarget.ticketId) {
        const result = await cancelTicketWithRefund(cancelTarget.ticketId, reason, releaseToPool);
        success = result.success;
        if (!result.success) errorMsg = result.error;
      } else if (cancelTarget.mode === 'order' && cancelTarget.orderId) {
        const result = await cancelOrderWithRefund(cancelTarget.orderId, reason, releaseToPool);
        success = result.success;
        if (!result.success) errorMsg = result.error;
      }

      if (success) {
        const poolMsg = releaseToPool ? ' Slots released back to pool.' : '';
        const msg = cancelTarget.mode === 'order'
          ? `All valid tickets cancelled and refunded.${poolMsg}`
          : `Ticket cancelled and refunded.${poolMsg}`;
        setFeedback({ type: 'success', message: msg });
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 1500);
      } else {
        setFeedback({ type: 'error', message: errorMsg });
      }
    });
  }

  // Get info for the modal
  const modalTicket = cancelTarget?.mode === 'ticket' && cancelTarget.ticketId
    ? tickets.find((t) => t.id === cancelTarget.ticketId)
    : null;
  const modalOrder = cancelTarget?.mode === 'order' && cancelTarget.orderId
    ? orderGroups.find((g) => g.order_id === cancelTarget.orderId)
    : null;

  return (
    <>
      <div className="space-y-4">
        {orderGroups.map((group) => (
          <div key={group.order_id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Order header */}
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">
                  Order #{group.order_id.slice(0, 8)}
                </span>
                <span>{group.tickets.length} ticket{group.tickets.length !== 1 ? 's' : ''}</span>
                <span>{formatCurrency(group.totalPrice, group.currency)}</span>
                <span>
                  {new Date(group.purchaseDate).toLocaleDateString('en-CA', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {group.hasValidTickets && group.validCount > 1 && (
                <button
                  onClick={() => openOrderModal(group.order_id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
                >
                  Cancel Entire Order ({group.validCount})
                </button>
              )}
            </div>

            {/* Tickets in this order */}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-2">Attendee</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {group.tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {ticket.attendee_name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {ticket.attendee_email}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {ticket.tier_name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {ticket.tier_price === 0
                        ? 'Free'
                        : formatCurrency(ticket.tier_price, ticket.currency)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block text-xs font-bold uppercase px-2 py-0.5 rounded ${
                          statusStyles[ticket.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {ticket.status === 'valid' && ticket.tier_price > 0 && (
                        <button
                          onClick={() => openTicketModal(ticket.id)}
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
        ))}
      </div>

      {/* Cancel Modal */}
      {cancelTarget && (modalTicket || modalOrder) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {cancelTarget.mode === 'order' ? 'Cancel Entire Order' : 'Cancel & Refund Ticket'}
            </h3>

            {modalTicket && (
              <p className="text-sm text-gray-500 mb-4">
                This will refund{' '}
                <span className="font-medium text-gray-700">
                  {formatCurrency(modalTicket.tier_price, modalTicket.currency)}
                </span>{' '}
                to <span className="font-medium text-gray-700">{modalTicket.attendee_name}</span> and
                notify them via email.
              </p>
            )}

            {modalOrder && (
              <p className="text-sm text-gray-500 mb-4">
                This will cancel{' '}
                <span className="font-medium text-gray-700">{modalOrder.validCount} valid ticket{modalOrder.validCount !== 1 ? 's' : ''}</span>
                {' '}and refund{' '}
                <span className="font-medium text-gray-700">
                  {formatCurrency(
                    modalOrder.tickets.filter((t) => t.status === 'valid').reduce((s, t) => s + t.tier_price, 0),
                    modalOrder.currency
                  )}
                </span>
                {' '}for Order #{modalOrder.order_id.slice(0, 8)}.
              </p>
            )}

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
              <p className="text-sm font-medium text-gray-700">What happens to the ticket slot{cancelTarget.mode === 'order' ? 's' : ''}?</p>
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
                    Ticket{cancelTarget.mode === 'order' ? 's stay' : ' stays'} on record as cancelled. Total capacity is reduced permanently.
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
                    Ticket{cancelTarget.mode === 'order' ? 's are' : ' is'} marked as refunded and the slot{cancelTarget.mode === 'order' ? 's become' : ' becomes'} available for purchase.
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
