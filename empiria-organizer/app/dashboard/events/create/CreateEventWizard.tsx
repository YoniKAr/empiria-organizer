'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Eye,
  Rocket,
  Plus,
  Trash2,
  MapPin,
  Calendar,
  Ticket,
  Image,
  FileText,
  Check,
  X,
  Globe,
  Monitor,
} from 'lucide-react';
import { createEvent, updateEvent, publishEvent } from '@/lib/actions';
import { getCurrencySymbol, formatCurrency } from '@/lib/utils';
import EventPreview from './EventPreview';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TicketTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  initial_quantity: number;
  max_per_order: number;
  sales_start_at: string;
  sales_end_at: string;
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
  location_type: 'physical' | 'virtual' | 'hybrid';
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

interface ExistingEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  category_id: string;
  tags: string[];
  cover_image_url: string;
  start_at: string;
  end_at: string;
  location_type: 'physical' | 'virtual' | 'hybrid';
  venue_name: string;
  address_text: string;
  city: string;
  currency: string;
  status: string;
  ticket_tiers: TicketTier[];
}

const STEPS = [
  { id: 0, label: 'Basics', icon: FileText },
  { id: 1, label: 'Date & Venue', icon: Calendar },
  { id: 2, label: 'Tickets', icon: Ticket },
  { id: 3, label: 'Media', icon: Image },
  { id: 4, label: 'Review', icon: Check },
];

const DEFAULT_TIER: TicketTier = {
  id: crypto.randomUUID(),
  name: '',
  description: '',
  price: 0,
  currency: 'cad',
  initial_quantity: 100,
  max_per_order: 10,
  sales_start_at: '',
  sales_end_at: '',
  is_hidden: false,
};

const INITIAL_FORM: EventFormData = {
  title: '',
  slug: '',
  description: '',
  category_id: '',
  tags: [],
  cover_image_url: '',
  start_at: '',
  end_at: '',
  location_type: 'physical',
  venue_name: '',
  address_text: '',
  city: '',
  currency: 'cad',
  ticket_tiers: [{ ...DEFAULT_TIER }],
};

// ─── Slug Generator ─────────────────────────────────────────────────────────
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function CreateEventWizard({
  categories,
  existingEvent,
}: {
  categories: Category[];
  existingEvent?: ExistingEvent;
}) {
  const router = useRouter();
  const isEditing = !!existingEvent;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EventFormData>(() => {
    if (existingEvent) {
      return {
        title: existingEvent.title,
        slug: existingEvent.slug,
        description: existingEvent.description,
        category_id: existingEvent.category_id,
        tags: existingEvent.tags,
        cover_image_url: existingEvent.cover_image_url,
        start_at: existingEvent.start_at,
        end_at: existingEvent.end_at,
        location_type: existingEvent.location_type,
        venue_name: existingEvent.venue_name,
        address_text: existingEvent.address_text,
        city: existingEvent.city,
        currency: existingEvent.currency,
        ticket_tiers: existingEvent.ticket_tiers.length > 0
          ? existingEvent.ticket_tiers
          : [{ ...DEFAULT_TIER }],
      };
    }
    return INITIAL_FORM;
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedEventId, setSavedEventId] = useState<string | null>(existingEvent?.id || null);
  const [showPreview, setShowPreview] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-generate slug from title (only for new events)
  useEffect(() => {
    if (!savedEventId && !isEditing) {
      setForm((f) => ({ ...f, slug: toSlug(f.title) }));
    }
  }, [form.title, savedEventId, isEditing]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ─── Field Updaters ─────────────────────────────────────────────────────
  const updateField = <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const updateTier = (index: number, field: keyof TicketTier, value: string | number | boolean) => {
    setForm((f) => {
      const tiers = [...f.ticket_tiers];
      tiers[index] = { ...tiers[index], [field]: value };
      return { ...f, ticket_tiers: tiers };
    });
  };

  const addTier = () => {
    setForm((f) => ({
      ...f,
      ticket_tiers: [...f.ticket_tiers, { ...DEFAULT_TIER, id: crypto.randomUUID() }],
    }));
  };

  const removeTier = (index: number) => {
    if (form.ticket_tiers.length <= 1) return;
    setForm((f) => ({
      ...f,
      ticket_tiers: f.ticket_tiers.filter((_, i) => i !== index),
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      updateField('tags', [...form.tags, tag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    updateField('tags', form.tags.filter((t) => t !== tag));
  };

  // ─── Validation ─────────────────────────────────────────────────────────
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!form.title.trim()) errs.title = 'Event title is required';
      if (!form.slug.trim()) errs.slug = 'Slug is required';
    }
    if (s === 1) {
      if (!form.start_at) errs.start_at = 'Start date is required';
      if (!form.end_at) errs.end_at = 'End date is required';
      if (form.start_at && form.end_at && new Date(form.end_at) <= new Date(form.start_at)) {
        errs.end_at = 'End must be after start';
      }
      if (form.location_type === 'physical' && !form.venue_name.trim()) {
        errs.venue_name = 'Venue name is required for physical events';
      }
    }
    if (s === 2) {
      form.ticket_tiers.forEach((tier, i) => {
        if (!tier.name.trim()) errs[`tier_${i}_name`] = 'Tier name is required';
        if (tier.initial_quantity <= 0) errs[`tier_${i}_qty`] = 'Must be > 0';
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Save Draft ─────────────────────────────────────────────────────────
  const saveDraft = async () => {
    setSaving(true);
    try {
      const result = savedEventId
        ? await updateEvent(savedEventId, form)
        : await createEvent(form);

      if (!result.success) throw new Error(result.error);

      if (!savedEventId && result.data.id) setSavedEventId(result.data.id);
      setToast({ message: isEditing ? 'Changes saved successfully' : 'Draft saved successfully', type: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Publish ────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    // Save first if not saved
    if (!savedEventId) await saveDraft();
    if (!savedEventId) return;

    setPublishing(true);
    try {
      const result = await publishEvent(savedEventId);
      if (!result.success) throw new Error(result.error);

      setToast({ message: 'Event published!', type: 'success' });
      setTimeout(() => router.push(isEditing ? `/dashboard/events/${savedEventId}` : '/dashboard/events'), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      setToast({ message, type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  // ─── Test Mode / Preview Toggle ─────────────────────────────────────────
  if (showPreview) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(false)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold">Test Mode — Attendee Preview</h1>
              <p className="text-sm text-gray-500">This is how attendees will see your event</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full text-xs font-bold">
            <Eye size={14} />
            TEST MODE
          </div>
        </div>
        <EventPreview form={form} categories={categories} />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#F98C1F]">{isEditing ? 'Edit Event' : 'Create New Event'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {savedEventId ? (isEditing ? 'Editing' : 'Draft saved') : 'Unsaved draft'} · Step {step + 1} of {STEPS.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Eye size={16} />
            Test Mode
          </button>
          <button
            onClick={saveDraft}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Draft'}
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 mb-8 bg-white rounded-xl border border-gray-200 p-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              if (s.id < step || validateStep(step)) setStep(s.id);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors ${s.id === step
              ? 'bg-black text-white'
              : s.id < step
                ? 'bg-green-50 text-green-700'
                : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            <s.icon size={14} />
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {step === 0 && (
          <StepBasics
            form={form}
            errors={errors}
            categories={categories}
            tagInput={tagInput}
            setTagInput={setTagInput}
            addTag={addTag}
            removeTag={removeTag}
            updateField={updateField}
          />
        )}
        {step === 1 && <StepDateVenue form={form} errors={errors} updateField={updateField} />}
        {step === 2 && (
          <StepTickets
            form={form}
            errors={errors}
            updateTier={updateTier}
            addTier={addTier}
            removeTier={removeTier}
          />
        )}
        {step === 3 && <StepMedia form={form} updateField={updateField} />}
        {step === 4 && (
          <StepReview form={form} categories={categories} onPreview={() => setShowPreview(true)} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={prevStep}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <div className="flex gap-3">
          {step < STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
            >
              <Rocket size={16} />
              {publishing ? 'Publishing...' : 'Publish Event'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function FieldLabel({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{children}</label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Input({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors focus:border-black ${error ? 'border-red-300 bg-red-50' : 'border-gray-200'
        } ${props.className || ''}`}
    />
  );
}

// ─── Step 1: Basics ─────────────────────────────────────────────────────────
function StepBasics({
  form,
  errors,
  categories,
  tagInput,
  setTagInput,
  addTag,
  removeTag,
  updateField,
}: {
  form: EventFormData;
  errors: Record<string, string>;
  categories: Category[];
  tagInput: string;
  setTagInput: (v: string) => void;
  addTag: () => void;
  removeTag: (t: string) => void;
  updateField: <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1 text-[#F98C1F]">Event Details</h2>
        <p className="text-sm text-gray-500">Start with the basics about your event.</p>
      </div>

      <div className="space-y-4">
        <div>
          <FieldLabel error={errors.title}>Event Title *</FieldLabel>
          <Input
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="e.g. Summer Music Festival 2026"
            error={errors.title}
            className="text-black"
          />
        </div>

        <div>
          <FieldLabel error={errors.slug}>URL Slug *</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">empiriaindia.com/events/</span>
            <Input
              value={form.slug}
              onChange={(e) => updateField('slug', toSlug(e.target.value))}
              placeholder="summer-music-festival"
              error={errors.slug}
              className="text-black"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={5}
            placeholder="Tell attendees what to expect at your event..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black resize-none text-black"
          />
        </div>

        <div>
          <FieldLabel>Category</FieldLabel>
          <select
            value={form.category_id}
            onChange={(e) => updateField('category_id', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black bg-white text-black"
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Tags</FieldLabel>
          <div className="flex gap-2 mb-2 ">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add a tag and press Enter"
              className="text-black"
            />
            <button
              onClick={addTag}
              type="button"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              Add
            </button>
          </div>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-medium"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Date & Venue ───────────────────────────────────────────────────
function StepDateVenue({
  form,
  errors,
  updateField,
}: {
  form: EventFormData;
  errors: Record<string, string>;
  updateField: <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">When & Where</h2>
        <p className="text-sm text-gray-500">Set the date, time, and location for your event.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel error={errors.start_at}>Start Date & Time *</FieldLabel>
          <Input
            type="datetime-local"
            value={form.start_at}
            onChange={(e) => updateField('start_at', e.target.value)}
            error={errors.start_at}
          />
        </div>
        <div>
          <FieldLabel error={errors.end_at}>End Date & Time *</FieldLabel>
          <Input
            type="datetime-local"
            value={form.end_at}
            onChange={(e) => updateField('end_at', e.target.value)}
            error={errors.end_at}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Location Type</FieldLabel>
        <div className="flex gap-3">
          {[
            { value: 'physical', label: 'In-Person', icon: MapPin },
            { value: 'virtual', label: 'Online', icon: Globe },
            { value: 'hybrid', label: 'Hybrid', icon: Monitor },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField('location_type', opt.value as EventFormData['location_type'])}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-medium transition-colors ${form.location_type === opt.value
                ? 'border-black bg-black text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
            >
              <opt.icon size={16} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {(form.location_type === 'physical' || form.location_type === 'hybrid') && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <FieldLabel error={errors.venue_name}>Venue Name *</FieldLabel>
            <Input
              value={form.venue_name}
              onChange={(e) => updateField('venue_name', e.target.value)}
              placeholder="e.g. The Grand Ballroom"
              error={errors.venue_name}
            />
          </div>
          <div>
            <FieldLabel>Address</FieldLabel>
            <Input
              value={form.address_text}
              onChange={(e) => updateField('address_text', e.target.value)}
              placeholder="Full street address"
            />
          </div>
          <div>
            <FieldLabel>City</FieldLabel>
            <Input
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="e.g. Mumbai"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Tickets ────────────────────────────────────────────────────────
function StepTickets({
  form,
  errors,
  updateTier,
  addTier,
  removeTier,
}: {
  form: EventFormData;
  errors: Record<string, string>;
  updateTier: (i: number, field: keyof TicketTier, value: string | number | boolean) => void;
  addTier: () => void;
  removeTier: (i: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold mb-1">Ticket Tiers</h2>
          <p className="text-sm text-gray-500">
            Create one or more ticket types. Set price to 0 for free tickets.
          </p>
        </div>
        <button
          onClick={addTier}
          type="button"
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <Plus size={14} />
          Add Tier
        </button>
      </div>

      <div className="space-y-4">
        {form.ticket_tiers.map((tier, i) => (
          <div key={tier.id} className="border border-gray-200 rounded-lg p-5 relative">
            {form.ticket_tiers.length > 1 && (
              <button
                onClick={() => removeTier(i)}
                type="button"
                className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 size={14} />
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel error={errors[`tier_${i}_name`]}>Tier Name *</FieldLabel>
                <Input
                  value={tier.name}
                  onChange={(e) => updateTier(i, 'name', e.target.value)}
                  placeholder="e.g. General Admission, VIP"
                  error={errors[`tier_${i}_name`]}
                />
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <Input
                  value={tier.description}
                  onChange={(e) => updateTier(i, 'description', e.target.value)}
                  placeholder="What's included"
                />
              </div>
              <div>
                <FieldLabel>Price ({getCurrencySymbol(form.currency)})</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.price}
                  onChange={(e) => updateTier(i, 'price', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <FieldLabel error={errors[`tier_${i}_qty`]}>Total Quantity *</FieldLabel>
                <Input
                  type="number"
                  min="1"
                  value={tier.initial_quantity}
                  onChange={(e) => updateTier(i, 'initial_quantity', parseInt(e.target.value) || 0)}
                  error={errors[`tier_${i}_qty`]}
                />
              </div>
              <div>
                <FieldLabel>Max Per Order</FieldLabel>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={tier.max_per_order}
                  onChange={(e) => updateTier(i, 'max_per_order', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-gray-600 pb-2.5">
                  <input
                    type="checkbox"
                    checked={tier.is_hidden}
                    onChange={(e) => updateTier(i, 'is_hidden', e.target.checked)}
                    className="rounded"
                  />
                  Hidden tier (invite-only)
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Media ──────────────────────────────────────────────────────────
function StepMedia({
  form,
  updateField,
}: {
  form: EventFormData;
  updateField: <K extends keyof EventFormData>(key: K, value: EventFormData[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">Event Media</h2>
        <p className="text-sm text-gray-500">Add a cover image for your event page.</p>
      </div>

      <div>
        <FieldLabel>Cover Image URL</FieldLabel>
        <Input
          value={form.cover_image_url}
          onChange={(e) => updateField('cover_image_url', e.target.value)}
          placeholder="https://example.com/my-event-banner.jpg"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          Paste a direct image URL. Recommended size: 1200×630px. File upload coming soon.
        </p>
      </div>

      {form.cover_image_url && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <img
            src={form.cover_image_url}
            alt="Cover preview"
            className="w-full h-64 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Step 5: Review ─────────────────────────────────────────────────────────
function StepReview({
  form,
  categories,
  onPreview,
}: {
  form: EventFormData;
  categories: Category[];
  onPreview: () => void;
}) {
  const cat = categories.find((c) => c.id === form.category_id);
  const totalTickets = form.ticket_tiers.reduce((sum, t) => sum + t.initial_quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold mb-1">Review Your Event</h2>
          <p className="text-sm text-gray-500">Make sure everything looks good before publishing.</p>
        </div>
        <button
          onClick={onPreview}
          className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-bold hover:bg-orange-100"
        >
          <Eye size={16} />
          Open Test Mode
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4x">
          <ReviewSection title="Basics" >
            <ReviewRow label="Title" value={form.title || '—'} />
            <ReviewRow label="Slug" value={form.slug || '—'} />
            <ReviewRow label="Category" value={cat?.name || 'None'} />
            <ReviewRow label="Tags" value={form.tags.join(', ') || 'None'} />
          </ReviewSection>

          <ReviewSection title="Date & Venue">
            <ReviewRow label="Start" value={form.start_at ? new Date(form.start_at).toLocaleString() : '—'} />
            <ReviewRow label="End" value={form.end_at ? new Date(form.end_at).toLocaleString() : '—'} />
            <ReviewRow label="Type" value={form.location_type} />
            {form.venue_name && <ReviewRow label="Venue" value={form.venue_name} />}
            {form.city && <ReviewRow label="City" value={form.city} />}
          </ReviewSection>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <ReviewSection title={`Tickets (${form.ticket_tiers.length} tier${form.ticket_tiers.length > 1 ? 's' : ''})`}>
            {form.ticket_tiers.map((tier) => (
              <div key={tier.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-600">{tier.name || 'Unnamed'}</span>
                <span className="font-medium">
                  {tier.price === 0 ? 'Free' : `${formatCurrency(tier.price, form.currency)}`} × {tier.initial_quantity}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between text-sm font-bold">
              <span>Total capacity</span>
              <span>{totalTickets}</span>
            </div>
          </ReviewSection>

          {form.cover_image_url && (
            <ReviewSection title="Cover Image">
              <img src={form.cover_image_url} alt="Cover" className="w-full h-32 object-cover rounded" />
            </ReviewSection>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
