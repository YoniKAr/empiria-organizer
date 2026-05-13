'use client';

import { useState } from 'react';
import { Send, Mail } from 'lucide-react';
import { sendEventUpdate } from '@/lib/actions';

export function SendUpdateForm({
  eventId,
  ticketHolderCount,
}: {
  eventId: string;
  ticketHolderCount: number;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      setResult({ type: 'error', text: 'Subject and message are required.' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await sendEventUpdate({ eventId, subject: subject.trim(), message: message.trim() });
      if (res.success) {
        setResult({ type: 'success', text: `Update sent to ${res.data.sent} ticket holder(s).` });
        setSubject('');
        setMessage('');
        setTimeout(() => setIsOpen(false), 3000);
      } else {
        setResult({ type: 'error', text: res.error });
      }
    } catch (err: any) {
      setResult({ type: 'error', text: err.message || 'Failed to send update.' });
    } finally {
      setSending(false);
    }
  };

  if (ticketHolderCount === 0) return null;

  return (
    <div>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => { setIsOpen(true); setResult(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Mail className="size-4" />
          Send Update to Ticket Holders
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="size-4 text-orange-600" />
              Send Update Email
            </h3>
            <span className="text-xs text-gray-500">
              {ticketHolderCount} recipient{ticketHolderCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Venue Change, Schedule Update..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                disabled={sending}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your update message here..."
                rows={5}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 resize-none"
                disabled={sending}
              />
            </div>
          </div>

          {result && (
            <div className={`text-sm px-3 py-2 rounded-lg ${result.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {result.text}
            </div>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setIsOpen(false); setResult(null); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              disabled={sending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim()}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="size-3.5" />
              {sending ? 'Sending...' : 'Send Update'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
