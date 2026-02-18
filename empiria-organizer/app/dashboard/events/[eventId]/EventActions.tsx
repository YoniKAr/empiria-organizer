'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { publishEvent, unpublishEvent, cancelEvent, deleteEvent } from '@/lib/actions';

interface EventActionsProps {
  eventId: string;
  status: string;
  hasTicketsSold: boolean;
}

export function EventActions({ eventId, status, hasTicketsSold }: EventActionsProps) {
  const [confirm, setConfirm] = useState<'unpublish' | 'cancel' | 'publish' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteReleaseToPool, setDeleteReleaseToPool] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSimpleAction(action: 'publish' | 'unpublish' | 'cancel') {
    setFeedback(null);
    startTransition(async () => {
      let result;
      switch (action) {
        case 'publish':
          result = await publishEvent(eventId);
          break;
        case 'unpublish':
          result = await unpublishEvent(eventId);
          break;
        case 'cancel':
          result = await cancelEvent(eventId);
          break;
      }

      if (result.success) {
        setConfirm(null);
        const label = action === 'publish' ? 'published' : action === 'unpublish' ? 'unpublished' : 'cancelled';
        setFeedback({ type: 'success', message: `Event ${label} successfully.` });
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: result.error });
      }
    });
  }

  function handleDelete() {
    setFeedback(null);
    startTransition(async () => {
      const result = await deleteEvent(
        eventId,
        hasTicketsSold ? deleteReason : undefined,
        hasTicketsSold ? deleteReleaseToPool : undefined
      );

      if (result.success) {
        if (result.data.mode === 'deleted') {
          router.push('/dashboard/events');
        } else {
          setShowDeleteModal(false);
          setFeedback({ type: 'success', message: 'All tickets refunded and event cancelled.' });
          router.refresh();
        }
      } else {
        setFeedback({ type: 'error', message: result.error });
      }
    });
  }

  function openDeleteModal() {
    setDeleteReason('');
    setDeleteReleaseToPool(false);
    setFeedback(null);
    setShowDeleteModal(true);
  }

  const canDelete = status !== 'completed';

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Edit — available for draft/published */}
        {(status === 'draft' || status === 'published') && (
          <Link
            href={`/dashboard/events/create?edit=${eventId}`}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Edit Event
          </Link>
        )}

        {/* Publish — only for drafts */}
        {status === 'draft' && (
          confirm === 'publish' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSimpleAction('publish')}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
              >
                {isPending ? 'Publishing…' : 'Confirm Publish'}
              </button>
              <button onClick={() => setConfirm(null)} disabled={isPending} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm('publish')}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
            >
              Publish
            </button>
          )
        )}

        {/* Unpublish — only for published */}
        {status === 'published' && (
          confirm === 'unpublish' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSimpleAction('unpublish')}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50"
              >
                {isPending ? 'Unpublishing…' : 'Confirm Unpublish'}
              </button>
              <button onClick={() => setConfirm(null)} disabled={isPending} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm('unpublish')}
              className="px-3 py-1.5 text-sm font-medium text-orange-600 border border-orange-300 bg-white hover:bg-orange-50 rounded-lg"
            >
              Unpublish
            </button>
          )
        )}

        {/* Cancel Event — for published/draft (status change only, no refunds) */}
        {(status === 'published' || status === 'draft') && (
          confirm === 'cancel' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSimpleAction('cancel')}
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {isPending ? 'Cancelling…' : 'Confirm Cancel Event'}
              </button>
              <button onClick={() => setConfirm(null)} disabled={isPending} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                Go Back
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm('cancel')}
              className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 bg-white hover:bg-red-50 rounded-lg"
            >
              Cancel Event
            </button>
          )
        )}

        {/* Delete Event */}
        {canDelete && (
          <button
            onClick={openDeleteModal}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
          >
            Delete Event
          </button>
        )}

        {feedback && !showDeleteModal && (
          <span className={`text-sm font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {feedback.message}
          </span>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Event</h3>

            {hasTicketsSold ? (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  This event has issued tickets. All valid tickets will be <span className="font-medium text-gray-700">refunded</span> and
                  attendees will be notified. The event will be marked as cancelled.
                </p>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cancellation reason (sent to attendees)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="e.g. Event cancelled due to unforeseen circumstances"
                />

                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">What happens to the ticket slots?</p>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-black has-[:checked]:bg-gray-50">
                    <input
                      type="radio"
                      name="deletePoolOption"
                      checked={!deleteReleaseToPool}
                      onChange={() => setDeleteReleaseToPool(false)}
                      className="mt-0.5 accent-black"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Keep cancelled</span>
                      <p className="text-xs text-gray-500 mt-0.5">Tickets marked as cancelled. Capacity reduced permanently.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-black has-[:checked]:bg-gray-50">
                    <input
                      type="radio"
                      name="deletePoolOption"
                      checked={deleteReleaseToPool}
                      onChange={() => setDeleteReleaseToPool(true)}
                      className="mt-0.5 accent-black"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Release back to pool</span>
                      <p className="text-xs text-gray-500 mt-0.5">Tickets marked as refunded. Inventory restored.</p>
                    </div>
                  </label>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 mb-4">
                This event has no tickets issued. It will be <span className="font-medium text-red-600">permanently deleted</span> from the database.
                This action cannot be undone.
              </p>
            )}

            {feedback && (
              <p className={`mt-3 text-sm font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {feedback.message}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowDeleteModal(false); setFeedback(null); }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Go Back
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending || (hasTicketsSold && !deleteReason.trim())}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {isPending
                  ? 'Processing…'
                  : hasTicketsSold
                    ? 'Refund All & Cancel Event'
                    : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
