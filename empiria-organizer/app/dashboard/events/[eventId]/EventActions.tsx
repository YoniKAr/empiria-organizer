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
  const [confirm, setConfirm] = useState<'unpublish' | 'cancel' | 'delete' | 'publish' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleAction(action: 'publish' | 'unpublish' | 'cancel' | 'delete') {
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
        case 'delete':
          result = await deleteEvent(eventId);
          break;
      }

      if (result.success) {
        if (action === 'delete') {
          router.push('/dashboard/events');
        } else {
          setConfirm(null);
          setFeedback({ type: 'success', message: `Event ${action === 'publish' ? 'published' : action === 'unpublish' ? 'unpublished' : 'cancelled'} successfully.` });
          router.refresh();
        }
      } else {
        setFeedback({ type: 'error', message: result.error });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Edit — always available for draft/published */}
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
              onClick={() => handleAction('publish')}
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
              onClick={() => handleAction('unpublish')}
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

      {/* Cancel Event — for published/draft */}
      {(status === 'published' || status === 'draft') && (
        confirm === 'cancel' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('cancel')}
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

      {/* Delete — only for drafts or cancelled events with no tickets sold */}
      {(status === 'draft' || (status === 'cancelled' && !hasTicketsSold)) && (
        confirm === 'delete' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('delete')}
              disabled={isPending}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              {isPending ? 'Deleting…' : 'Confirm Delete Forever'}
            </button>
            <button onClick={() => setConfirm(null)} disabled={isPending} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
              Go Back
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm('delete')}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
          >
            Delete Event
          </button>
        )
      )}

      {feedback && (
        <span className={`text-sm font-medium ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {feedback.message}
        </span>
      )}
    </div>
  );
}
