'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { issueTicketsManually, sendTicketsToEmail } from '@/lib/actions';
import { formatCurrency } from '@/lib/utils';

interface TierOption {
  id: string;
  name: string;
  price: number;
  currency: string;
  remaining: number;
}

interface IssueTicketsModalProps {
  eventId: string;
  tiers: TierOption[];
}

export function IssueTicketsModal({ eventId, tiers }: IssueTicketsModalProps) {
  const [open, setOpen] = useState(false);
  const [tierId, setTierId] = useState(tiers[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [reason, setReason] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [issuedTicketIds, setIssuedTicketIds] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const router = useRouter();

  const selectedTier = tiers.find((t) => t.id === tierId);

  function resetForm() {
    setTierId(tiers[0]?.id || '');
    setQuantity(1);
    setAttendeeName('');
    setAttendeeEmail('');
    setReason('');
    setIsFree(true);
    setFeedback(null);
    setIssuedTicketIds([]);
    setSendingEmail(false);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleSubmit() {
    if (!tierId || !attendeeName.trim() || !attendeeEmail.trim() || !reason.trim()) return;

    startTransition(async () => {
      const result = await issueTicketsManually({
        eventId,
        tierId,
        quantity,
        attendeeName: attendeeName.trim(),
        attendeeEmail: attendeeEmail.trim(),
        reason: reason.trim(),
        isFree,
      });

      if (result.success) {
        setIssuedTicketIds(result.data.ticketIds);
        setFeedback({
          type: 'success',
          message: `${result.data.ticketIds.length} ticket${result.data.ticketIds.length !== 1 ? 's' : ''} issued successfully.`,
        });
      } else {
        setFeedback({ type: 'error', message: result.error });
      }
    });
  }

  function handleSendEmail() {
    if (!issuedTicketIds.length || !attendeeEmail.trim() || !attendeeName.trim()) return;
    setSendingEmail(true);
    startTransition(async () => {
      const result = await sendTicketsToEmail({
        ticketIds: issuedTicketIds,
        recipientEmail: attendeeEmail.trim(),
        recipientName: attendeeName.trim(),
      });
      setSendingEmail(false);
      if (result.success) {
        setFeedback({ type: 'success', message: `Tickets sent to ${attendeeEmail.trim()}` });
        setTimeout(() => { setOpen(false); router.refresh(); }, 1200);
      } else {
        setFeedback({ type: 'error', message: result.error });
      }
    });
  }

  function handleDone() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-3 py-1.5 text-sm font-medium text-white bg-[#F98C1F] hover:bg-[#e07b10] rounded-lg transition-colors"
      >
        + Issue Tickets
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Issue Tickets Manually</h3>

            {/* Tier selector */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Tier</label>
            <select
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.price === 0 ? 'Free' : formatCurrency(t.price, t.currency)} ({t.remaining} remaining)
                </option>
              ))}
            </select>

            {/* Quantity */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={selectedTier?.remaining || 100}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />

            {/* Attendee Name */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Attendee Name</label>
            <input
              type="text"
              value={attendeeName}
              onChange={(e) => setAttendeeName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />

            {/* Attendee Email */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Attendee Email</label>
            <input
              type="email"
              value={attendeeEmail}
              onChange={(e) => setAttendeeEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />

            {/* Reason */}
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Complimentary, sponsor, speaker"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />

            {/* Free / Paid toggle */}
            {selectedTier && selectedTier.price > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isFree}
                    onChange={() => setIsFree(true)}
                    className="accent-black"
                  />
                  <span className="text-sm text-gray-700">Free (complimentary)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isFree}
                    onChange={() => setIsFree(false)}
                    className="accent-black"
                  />
                  <span className="text-sm text-gray-700">
                    Paid ({formatCurrency(selectedTier.price * quantity, selectedTier.currency)})
                  </span>
                </label>
              </div>
            )}

            {feedback && (
              <p className={`text-sm font-medium mb-3 ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {feedback.message}
              </p>
            )}

            <div className="flex justify-end gap-2">
              {issuedTicketIds.length > 0 ? (
                <>
                  <button
                    onClick={handleDone}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Done
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#F98C1F] hover:bg-[#e07b10] rounded-lg disabled:opacity-50"
                  >
                    {sendingEmail ? 'Sending...' : 'Send via Email'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isPending || !tierId || !attendeeName.trim() || !attendeeEmail.trim() || !reason.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#F98C1F] hover:bg-[#e07b10] rounded-lg disabled:opacity-50"
                  >
                    {isPending ? 'Issuing...' : `Issue ${quantity} Ticket${quantity !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
