'use client';

import { useState, useEffect, useMemo } from 'react';
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
  ImageIcon,
  FileText,
  Check,
  X,
  Globe,
  Monitor,
  Upload,
  Heart,
  Users,
  Info,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Textarea } from '@/components/textarea';
import { Label } from '@/components/label';
import { Badge } from '@/components/badge';
import { Checkbox } from '@/components/checkbox';
import { Separator } from '@/components/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/select'; //

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
  zip_code: string;
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
  { id: 3, label: 'Media', icon: ImageIcon },
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
  zip_code: '',
  currency: 'cad',
  ticket_tiers: [{ ...DEFAULT_TIER }],
};

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
        zip_code: '',
        currency: existingEvent.currency,
        ticket_tiers:
          existingEvent.ticket_tiers.length > 0
            ? existingEvent.ticket_tiers
            : [{ ...DEFAULT_TIER }],
      };
    }
    return INITIAL_FORM;
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedEventId, setSavedEventId] = useState<string | null>(
    existingEvent?.id || null
  );
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    if (!savedEventId && !isEditing) {
      setForm((f) => ({ ...f, slug: toSlug(f.title) }));
    }
  }, [form.title, savedEventId, isEditing]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const updateField = <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const updateTier = (
    index: number,
    field: keyof TicketTier,
    value: string | number | boolean
  ) => {
    setForm((f) => {
      const tiers = [...f.ticket_tiers];
      tiers[index] = { ...tiers[index], [field]: value };
      return { ...f, ticket_tiers: tiers };
    });
  };

  const addTier = () => {
    setForm((f) => ({
      ...f,
      ticket_tiers: [
        ...f.ticket_tiers,
        { ...DEFAULT_TIER, id: crypto.randomUUID() },
      ],
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
    updateField(
      'tags',
      form.tags.filter((t) => t !== tag)
    );
  };

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!form.title.trim()) errs.title = 'Event title is required';
      if (!form.slug.trim()) errs.slug = 'Slug is required';
    }
    if (s === 1) {
      if (!form.start_at) errs.start_at = 'Start date is required';
      if (!form.end_at) errs.end_at = 'End date is required';
      if (
        form.start_at &&
        form.end_at &&
        new Date(form.end_at) <= new Date(form.start_at)
      ) {
        errs.end_at = 'End must be after start';
      }
      if (form.location_type === 'physical' && !form.venue_name.trim()) {
        errs.venue_name = 'Venue name is required for physical events';
      }
    }
    if (s === 2) {
      form.ticket_tiers.forEach((tier, i) => {
        if (!tier.name.trim())
          errs[`tier_${i}_name`] = 'Tier name is required';
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

  const saveDraft = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!savedEventId) setSavedEventId(crypto.randomUUID());
      setToast({
        message: isEditing
          ? 'Changes saved successfully'
          : 'Draft saved successfully',
        type: 'success',
      });
    } catch {
      setToast({ message: 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!savedEventId) await saveDraft();
    setPublishing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setToast({ message: 'Event published!', type: 'success' });
    } catch {
      setToast({ message: 'Publish failed', type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all',
            toast.type === 'success'
              ? 'bg-[#16a34a] text-[#fff]'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          {toast.type === 'success' && <Check className="size-4" />}
          {toast.message}
        </div>
      )}

      {/* ─── LEFT: Form Panel ─────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-1 flex-col lg:max-w-[60%]">
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4 lg:px-8">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                {isEditing ? 'Edit Event' : 'Create New Event'}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Step {step + 1} of {STEPS.length}: {STEPS[step].label}
              </p>
            </div>

            {/* Step dots */}
            <div className="hidden items-center gap-1 sm:flex">
              {STEPS.map((s, i) => {
                const isActive = i === step;
                const isCompleted = i < step;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (i < step || validateStep(step)) setStep(i);
                    }}
                    className="flex items-center gap-1"
                    aria-label={`Go to step ${s.label}`}
                  >
                    {i > 0 && (
                      <span
                        className={cn(
                          'h-[2px] w-4 rounded-full transition-colors',
                          isCompleted
                            ? 'bg-foreground'
                            : 'bg-border'
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'flex items-center justify-center rounded-full transition-all',
                        isActive
                          ? 'size-3 bg-primary'
                          : isCompleted
                            ? 'size-2.5 bg-foreground'
                            : 'size-2.5 bg-border'
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { }}
                className="gap-1.5 text-xs"
              >
                <Eye className="size-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveDraft}
                disabled={saving}
                className="gap-1.5 text-xs"
              >
                <Save className="size-3.5" />
                <span className="hidden sm:inline">
                  {saving ? 'Saving...' : 'Save Draft'}
                </span>
              </Button>
            </div>
          </div>
        </header>

        {/* Form content */}
        <div className="flex-1 px-6 py-8 lg:px-8">
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
          {step === 1 && (
            <StepDateVenue
              form={form}
              errors={errors}
              updateField={updateField}
            />
          )}
          {step === 2 && (
            <StepTickets
              form={form}
              errors={errors}
              updateTier={updateTier}
              addTier={addTier}
              removeTier={removeTier}
            />
          )}
          {step === 3 && (
            <StepMedia form={form} updateField={updateField} />
          )}
          {step === 4 && (
            <StepReview form={form} categories={categories} />
          )}
        </div>

        {/* Navigation - sticky bottom */}
        <div className="sticky bottom-0 bg-gradient-to-t from-background via-background/90 to-transparent px-6 pb-6 pt-8 lg:px-8">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={step === 0}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={nextStep}
                className="gap-1.5 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
              >
                Continue
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="gap-1.5 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
              >
                <Rocket className="size-4" />
                {publishing ? 'Publishing...' : 'Publish Event'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Live Preview Panel ─────────────────────────────────── */}
      <aside className="hidden border-l border-border lg:block lg:w-[40%]">
        <div className="sticky top-0 h-screen overflow-y-auto bg-[#faf9f7]">
          <LivePreview form={form} categories={categories} />
        </div>
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE PREVIEW PANEL
// ═══════════════════════════════════════════════════════════════════════════

function LivePreview({
  form,
  categories,
}: {
  form: EventFormData;
  categories: Category[];
}) {
  const cat = categories.find((c) => c.id === form.category_id);
  const lowestPrice = useMemo(() => {
    const prices = form.ticket_tiers
      .filter((t) => t.name.trim())
      .map((t) => t.price);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  }, [form.ticket_tiers]);

  const startDate = form.start_at ? new Date(form.start_at) : null;
  const locationLabel =
    form.location_type === 'physical'
      ? 'In-Person'
      : form.location_type === 'virtual'
        ? 'Online'
        : 'Hybrid';

  return (
    <div className="flex h-full flex-col items-center px-8 py-10">
      {/* Header */}
      <div className="mb-10 flex w-full max-w-sm items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Live Preview
        </p>
        <Badge
          variant="outline"
          className="border-primary/30 bg-primary/5 text-xs font-medium text-primary"
        >
          Event Card
        </Badge>
      </div>

      {/* Floating card with orange glow */}
      <div className="relative mx-auto w-full max-w-sm">
        {/* Animated orange glow - outer layer */}
        <div
          className="absolute -inset-4 animate-float-glow rounded-3xl blur-2xl"
          style={{ background: 'rgba(225, 140, 50, 0.25)' }}
        />
        {/* Animated orange glow - inner layer */}
        <div
          className="absolute -inset-2 animate-float-glow-inner rounded-2xl blur-lg"
          style={{ background: 'rgba(225, 140, 50, 0.15)' }}
        />

        {/* Event Card */}
        <div
          className="relative animate-float overflow-hidden rounded-2xl bg-card shadow-2xl"
          style={{ border: '1.5px solid rgba(225, 140, 50, 0.3)' }}
        >
          {/* Image */}
          <div className="relative h-44 overflow-hidden bg-muted">
            {form.cover_image_url ? (
              <img
                src={form.cover_image_url}
                alt="Event cover"
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F98C1F] to-[#e07b10]">
                <ImageIcon className="size-12 text-white/80" />
              </div>
            )}

            {/* Location badge */}
            <div className="absolute top-3 left-3">
              <Badge className="border-0 bg-foreground/70 text-[11px] font-medium text-card backdrop-blur-sm">
                {locationLabel}
              </Badge>
            </div>

            {/* Heart icon */}
            <button
              className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-card/30 text-card backdrop-blur-sm transition-colors hover:bg-card/50"
              aria-label="Save event"
            >
              <Heart className="size-4" />
            </button>

            {/* Category tag */}
            {cat && (
              <div className="absolute bottom-3 left-3">
                <Badge className="border-0 bg-primary text-[11px] font-medium text-primary-foreground">
                  {cat.name}
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Date + Title */}
            <div className="flex gap-3.5">
              {startDate && (
                <div className="flex shrink-0 flex-col items-center rounded-lg border border-border px-2.5 py-1.5">
                  <span className="text-[10px] font-bold uppercase text-primary">
                    {startDate.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-lg font-bold leading-tight text-foreground">
                    {startDate.getDate()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">
                  {form.title || 'Your Event Title'}
                </h3>
                {startDate && (
                  <p className="mt-0.5 text-sm text-primary">
                    {startDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                    })}
                    {', '}
                    {startDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            {(form.venue_name || form.city) && (
              <div className="mt-3.5 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">
                  {form.venue_name}
                  {form.city ? `, ${form.city}` : ''}
                </span>
              </div>
            )}

            {/* Tickets */}
            {lowestPrice !== null && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Ticket className="size-3.5 shrink-0 text-primary" />
                {lowestPrice === 0
                  ? 'Free tickets available'
                  : `Tickets from $${lowestPrice.toFixed(0)}`}
              </div>
            )}

            <Separator className="my-4" />

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-2">
                  <div className="size-7 rounded-full border-2 border-card bg-[#3a7d5c]" />
                  <div className="size-7 rounded-full border-2 border-card bg-[#5a6e8f]" />
                </div>
                <span className="ml-1 text-xs text-muted-foreground">+42</span>
              </div>
              <button className="text-sm font-semibold text-primary hover:underline">
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info note */}
      <div className="mx-auto mt-10 flex max-w-sm items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <Info className="size-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          This is how your event will appear in the search results.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function FormField({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
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
  updateField: <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Event Details"
        description="Start with the basics. Give your event a name and tell people what to expect."
      />

      <div className="space-y-6">
        <FormField label="Event Title" error={errors.title} required>
          <Input
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="e.g. Annual Tech Conference 2026"
            aria-invalid={!!errors.title}
            className="h-11"
          />
        </FormField>

        <FormField
          label="URL Slug"
          error={errors.slug}
          required
          hint="This will be used in the event URL"
        >
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-md bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground">
              /events/
            </span>
            <Input
              value={form.slug}
              onChange={(e) => updateField('slug', toSlug(e.target.value))}
              placeholder="annual-tech-conference"
              aria-invalid={!!errors.slug}
              className="h-11"
            />
          </div>
        </FormField>

        <FormField label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={4}
            placeholder="Tell attendees what to expect, what they'll learn, who should come..."
            className="resize-none"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField label="Category">
            <Select
              value={form.category_id}
              onValueChange={(v) => updateField('category_id', v)}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Currency">
            <Select
              value={form.currency}
              onValueChange={(v) => updateField('currency', v)}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cad">CAD</SelectItem>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
                <SelectItem value="gbp">GBP</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="Tags" hint="Press Enter to add a tag">
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add a tag and press Enter"
              className="h-11"
            />
            <Button
              onClick={addTag}
              type="button"
              variant="outline"
              size="sm"
              className="h-11 shrink-0 px-4"
            >
              Add
            </Button>
          </div>
          {form.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {form.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1.5"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    aria-label={`Remove ${tag} tag`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </FormField>
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
  updateField: <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="When & Where"
        description="Set the date, time, and location details for your upcoming event."
      />

      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Start Date & Time"
            error={errors.start_at}
            required
          >
            <Input
              type="datetime-local"
              value={form.start_at}
              onChange={(e) => updateField('start_at', e.target.value)}
              aria-invalid={!!errors.start_at}
              className="h-11"
            />
          </FormField>
          <FormField label="End Date & Time" error={errors.end_at} required>
            <Input
              type="datetime-local"
              value={form.end_at}
              onChange={(e) => updateField('end_at', e.target.value)}
              aria-invalid={!!errors.end_at}
              className="h-11"
            />
          </FormField>
        </div>

        {/* Location Type */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">
            Location Type
          </Label>
          <div className="flex gap-3">
            {[
              { value: 'physical', label: 'In-Person', icon: MapPin },
              { value: 'virtual', label: 'Online', icon: Globe },
              { value: 'hybrid', label: 'Hybrid', icon: Monitor },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  updateField(
                    'location_type',
                    opt.value as EventFormData['location_type']
                  )
                }
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium transition-all',
                  form.location_type === opt.value
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
                )}
              >
                <opt.icon className="size-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Venue Details */}
        {(form.location_type === 'physical' ||
          form.location_type === 'hybrid') && (
            <div className="space-y-5 rounded-xl border border-border bg-card p-6">
              <FormField
                label="Venue Name"
                error={errors.venue_name}
                required
              >
                <Input
                  value={form.venue_name}
                  onChange={(e) => updateField('venue_name', e.target.value)}
                  placeholder="e.g. The Grand Ballroom"
                  aria-invalid={!!errors.venue_name}
                  className="h-11"
                />
              </FormField>
              <FormField label="Full Address">
                <div className="relative">
                  <Search className="absolute top-3.5 left-3 size-4 text-muted-foreground" />
                  <Input
                    value={form.address_text}
                    onChange={(e) =>
                      updateField('address_text', e.target.value)
                    }
                    placeholder="Start typing address..."
                    className="h-11 pl-9"
                  />
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="City">
                  <Input
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="h-11"
                  />
                </FormField>
                <FormField label="Zip Code">
                  <Input
                    value={form.zip_code}
                    onChange={(e) => updateField('zip_code', e.target.value)}
                    placeholder="e.g. 400001"
                    className="h-11"
                  />
                </FormField>
              </div>
            </div>
          )}
      </div>
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
  updateTier: (
    i: number,
    field: keyof TicketTier,
    value: string | number | boolean
  ) => void;
  addTier: () => void;
  removeTier: (i: number) => void;
}) {
  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Ticket Tiers
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Create one or more ticket types. Set price to 0 for free tickets.
          </p>
        </div>
        <Button
          onClick={addTier}
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
        >
          <Plus className="size-3.5" />
          Add Tier
        </Button>
      </div>

      <div className="space-y-5">
        {form.ticket_tiers.map((tier, i) => (
          <div
            key={tier.id}
            className="relative rounded-xl border border-border bg-card p-6"
          >
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-primary" />
            {form.ticket_tiers.length > 1 && (
              <Button
                onClick={() => removeTier(i)}
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}

            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-primary">
              Tier {i + 1}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Tier Name"
                error={errors[`tier_${i}_name`]}
                required
              >
                <Input
                  value={tier.name}
                  onChange={(e) => updateTier(i, 'name', e.target.value)}
                  placeholder="e.g. General Admission, VIP"
                  aria-invalid={!!errors[`tier_${i}_name`]}
                  className="h-11"
                />
              </FormField>
              <FormField label="Description">
                <Input
                  value={tier.description}
                  onChange={(e) =>
                    updateTier(i, 'description', e.target.value)
                  }
                  placeholder="What's included"
                  className="h-11"
                />
              </FormField>
              <FormField
                label={`Price (${form.currency.toUpperCase()})`}
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.price}
                  onChange={(e) =>
                    updateTier(i, 'price', parseFloat(e.target.value) || 0)
                  }
                  className="h-11"
                />
              </FormField>
              <FormField
                label="Total Quantity"
                error={errors[`tier_${i}_qty`]}
                required
              >
                <Input
                  type="number"
                  min="1"
                  value={tier.initial_quantity}
                  onChange={(e) =>
                    updateTier(
                      i,
                      'initial_quantity',
                      parseInt(e.target.value) || 0
                    )
                  }
                  aria-invalid={!!errors[`tier_${i}_qty`]}
                  className="h-11"
                />
              </FormField>
              <FormField label="Max Per Order">
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={tier.max_per_order}
                  onChange={(e) =>
                    updateTier(
                      i,
                      'max_per_order',
                      parseInt(e.target.value) || 1
                    )
                  }
                  className="h-11"
                />
              </FormField>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Checkbox
                    checked={tier.is_hidden}
                    onCheckedChange={(checked) =>
                      updateTier(i, 'is_hidden', !!checked)
                    }
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
  updateField: <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Event Media"
        description="Add a cover image to make your event stand out in listings."
      />

      <div className="space-y-6">
        <FormField
          label="Cover Image URL"
          hint="Paste a direct image URL. Recommended size: 1200 x 630px."
        >
          <Input
            value={form.cover_image_url}
            onChange={(e) => updateField('cover_image_url', e.target.value)}
            placeholder="https://example.com/my-event-banner.jpg"
            className="h-11"
          />
        </FormField>

        {form.cover_image_url ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <img
              src={form.cover_image_url}
              alt="Cover preview"
              className="h-56 w-full object-cover"
              crossOrigin="anonymous"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/50">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
              <Upload className="size-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                No image yet
              </p>
              <p className="text-xs text-muted-foreground">
                Paste a URL above to preview your cover image
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 5: Review ─────────────────────────────────────────────────────────
function StepReview({
  form,
  categories,
}: {
  form: EventFormData;
  categories: Category[];
}) {
  const cat = categories.find((c) => c.id === form.category_id);
  const totalTickets = form.ticket_tiers.reduce(
    (sum, t) => sum + t.initial_quantity,
    0
  );

  return (
    <div>
      <SectionHeader
        title="Review Your Event"
        description="Make sure everything looks good before publishing."
      />

      <div className="space-y-5">
        <ReviewCard title="Event Basics" icon={FileText}>
          <ReviewRow label="Title" value={form.title || '\u2014'} />
          <ReviewRow label="Slug" value={form.slug || '\u2014'} />
          <ReviewRow label="Category" value={cat?.name || 'None'} />
          <ReviewRow label="Tags" value={form.tags.join(', ') || 'None'} />
        </ReviewCard>

        <ReviewCard title="Date & Venue" icon={Calendar}>
          <ReviewRow
            label="Start"
            value={
              form.start_at
                ? new Date(form.start_at).toLocaleString()
                : '\u2014'
            }
          />
          <ReviewRow
            label="End"
            value={
              form.end_at ? new Date(form.end_at).toLocaleString() : '\u2014'
            }
          />
          <ReviewRow label="Type" value={form.location_type} />
          {form.venue_name && (
            <ReviewRow label="Venue" value={form.venue_name} />
          )}
          {form.city && <ReviewRow label="City" value={form.city} />}
        </ReviewCard>

        <ReviewCard
          title={`Tickets (${form.ticket_tiers.length} tier${form.ticket_tiers.length > 1 ? 's' : ''})`}
          icon={Ticket}
        >
          {form.ticket_tiers.map((tier) => (
            <div
              key={tier.id}
              className="flex justify-between py-1.5 text-sm"
            >
              <span className="text-muted-foreground">
                {tier.name || 'Unnamed'}
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                {tier.price === 0 ? 'Free' : `$${tier.price.toFixed(2)}`}{' '}
                {'x'} {tier.initial_quantity}
              </span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between text-sm font-bold text-foreground">
            <span>Total capacity</span>
            <span className="tabular-nums">{totalTickets}</span>
          </div>
        </ReviewCard>

        {form.cover_image_url && (
          <ReviewCard title="Cover Image" icon={ImageIcon}>
            <img
              src={form.cover_image_url}
              alt="Cover"
              className="h-32 w-full rounded-lg object-cover"
              crossOrigin="anonymous"
            />
          </ReviewCard>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
