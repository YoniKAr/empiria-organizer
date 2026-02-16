'use client';

import { useState } from 'react';
import { MapPin, Calendar, Clock, Ticket, Users, Share2, Heart, Minus, Plus } from 'lucide-react';

interface TicketTier {
  id: string;
  name: string;
  description: string;
  price: number;
  initial_quantity: number;
  max_per_order: number;
  is_hidden: boolean;
}

interface EventFormData {
  title: string;
  slug: string;
  description: string;
  category_id: string;
  tags: string[];
  cover_image_url: string;
  start_at: string;
  end_at: string;
  location_type: string;
  venue_name: string;
  address_text: string;
  city: string;
  currency: string;
  ticket_tiers: TicketTier[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function EventPreview({
  form,
  categories,
}: {
  form: EventFormData;
  categories: Category[];
}) {
  const cat = categories.find((c) => c.id === form.category_id);
  const [selectedTiers, setSelectedTiers] = useState<Record<string, number>>({});
  const [showCheckout, setShowCheckout] = useState(false);

  const visibleTiers = form.ticket_tiers.filter((t) => !t.is_hidden);

  const updateQty = (tierId: string, delta: number, max: number) => {
    setSelectedTiers((prev) => {
      const current = prev[tierId] || 0;
      const next = Math.max(0, Math.min(current + delta, max));
      return { ...prev, [tierId]: next };
    });
  };

  const totalSelected = Object.values(selectedTiers).reduce((s, n) => s + n, 0);
  const totalPrice = visibleTiers.reduce((sum, tier) => {
    return sum + (selectedTiers[tier.id] || 0) * tier.price;
  }, 0);

  const startDate = form.start_at ? new Date(form.start_at) : null;
  const endDate = form.end_at ? new Date(form.end_at) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Test Mode Banner */}
      <div className="bg-orange-500 text-white text-center text-xs font-bold py-1.5 tracking-wide">
        ⚡ TEST MODE — This is a preview. No tickets will be sold.
      </div>

      {/* Cover Image */}
      <div className="h-72 bg-gradient-to-br from-gray-800 to-gray-900 relative">
        {form.cover_image_url ? (
          <img
            src={form.cover_image_url}
            alt={form.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No cover image set
          </div>
        )}
        {/* Category Badge */}
        {cat && (
          <span className="absolute top-4 left-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full">
            {cat.name}
          </span>
        )}
      </div>

      <div className="p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Event Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Tags */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {form.title || 'Untitled Event'}
              </h1>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Date & Location Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {startDate && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                  <div className="bg-black text-white p-2 rounded-lg">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {startDate.toLocaleDateString('en-IN', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Clock size={12} />
                      {startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {endDate &&
                        ` – ${endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                </div>
              )}

              {form.venue_name && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-lg p-4">
                  <div className="bg-black text-white p-2 rounded-lg">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{form.venue_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[form.address_text, form.city].filter(Boolean).join(', ') || 'Address TBA'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {form.description && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">About this event</h2>
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {form.description}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-not-allowed opacity-60">
                <Heart size={16} />
                Save
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-not-allowed opacity-60">
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>

          {/* Right: Ticket Selection */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Ticket size={18} />
                Select Tickets
              </h3>

              {visibleTiers.length === 0 ? (
                <p className="text-sm text-gray-400">No tickets configured yet</p>
              ) : (
                <div className="space-y-3">
                  {visibleTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className="border border-gray-100 rounded-lg p-3"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {tier.name || 'Unnamed Tier'}
                          </p>
                          {tier.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-900 whitespace-nowrap ml-2">
                          {tier.price === 0 ? 'Free' : `₹${tier.price.toLocaleString('en-IN')}`}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Users size={12} />
                          {tier.initial_quantity} available
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQty(tier.id, -1, tier.max_per_order)}
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">
                            {selectedTiers[tier.id] || 0}
                          </span>
                          <button
                            onClick={() => updateQty(tier.id, 1, tier.max_per_order)}
                            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Checkout Summary */}
              {totalSelected > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-gray-600">{totalSelected} ticket{totalSelected > 1 ? 's' : ''}</span>
                    <span className="font-bold">
                      {totalPrice === 0 ? 'Free' : `₹${totalPrice.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-orange-700 transition-colors"
                  >
                    Get Tickets
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Test Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-center">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ticket size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2">Test Mode Checkout</h3>
            <p className="text-sm text-gray-500 mb-2">
              In production, this would redirect to Stripe Checkout for payment processing.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Tickets</span>
                <span className="font-bold">{totalSelected}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total</span>
                <span className="font-bold">
                  {totalPrice === 0 ? 'Free' : `₹${totalPrice.toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowCheckout(false)}
              className="w-full bg-black text-white py-2.5 rounded-lg font-medium text-sm"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
