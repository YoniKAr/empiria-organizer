'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  LayoutGrid,
  List,
  Map,
  Armchair,
  AlertTriangle,
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
import { createEvent, updateEvent, publishEvent, saveRevenueSplits } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { SeatmapDesigner } from '@/components/seatmap/SeatmapDesigner';
import { SeatRangeEditor } from '@/components/seatmap/SeatRangeEditor';
import { useImageUpload } from '@/components/seatmap/useImageUpload';
import { RevenueSplitsEditor } from '@/components/RevenueSplitsEditor';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { ZoneListEditor } from '@/components/seatmap/ZoneListEditor';
import type { SeatingMode, SeatingConfig, ZoneDefinition } from '@/lib/seatmap-types';

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

interface Occurrence {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
}

interface EventFormData {
  title: string;
  slug: string;
  description: string;
  what_to_expect: string[];
  category_id: string;
  tags: string[];
  cover_image_url: string;
  photo_urls: string[];
  sales_start_at: string;
  sales_end_at: string;
  occurrences: Occurrence[];
  location_type: 'physical' | 'virtual' | 'hybrid';
  venue_name: string;
  address_text: string;
  city: string;
  zip_code: string;
  currency: string;
  ticket_tiers: TicketTier[];
  seating_type: SeatingMode;
  seating_config: SeatingConfig | null;
  pass_processing_fee: boolean;
  charge_ticket_tax: boolean;
  refund_policy: 'fully_refundable' | 'non_refundable' | 'partial_refundable';
  show_remaining_seats: boolean;
  sponsor_logos: string[];
  trailer_url: string;
  revenue_splits: Array<{
    id: string;
    recipientUserId: string;
    recipientStripeId: string;
    recipientName: string;
    recipientEmail: string;
    percentage: number;
    description: string;
  }>;
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
  what_to_expect: string[];
  category_id: string;
  tags: string[];
  cover_image_url: string;
  sales_start_at: string;
  sales_end_at: string;
  location_type: 'physical' | 'virtual' | 'hybrid';
  venue_name: string;
  address_text: string;
  city: string;
  currency: string;
  status: string;
  ticket_tiers: TicketTier[];
  event_occurrences: { id: string; starts_at: string; ends_at: string; label: string }[];
}

const STEPS = [
  { id: 0, label: 'Basics', icon: FileText },
  { id: 1, label: 'Date & Venue', icon: Calendar },
  { id: 2, label: 'Tickets & Seating', icon: Ticket },
  { id: 3, label: 'Media', icon: ImageIcon },
  { id: 4, label: 'Review', icon: Check },
];

function makeDefaultTier(name: string, currency: string = 'cad'): TicketTier {
  return {
    id: crypto.randomUUID(),
    name,
    description: '',
    price: 0,
    currency,
    initial_quantity: 100,
    max_per_order: 10,
    sales_start_at: '',
    sales_end_at: '',
    is_hidden: false,
  };
}

const DEFAULT_OCCURRENCE: Occurrence = {
  id: crypto.randomUUID(),
  starts_at: '',
  ends_at: '',
  label: '',
};

const INITIAL_FORM: EventFormData = {
  title: '',
  slug: '',
  description: '',
  what_to_expect: [''],
  category_id: '',
  tags: [],
  cover_image_url: '',
  photo_urls: [],
  sales_start_at: '',
  sales_end_at: '',
  occurrences: [{ ...DEFAULT_OCCURRENCE }],
  location_type: 'physical',
  venue_name: '',
  address_text: '',
  city: '',
  zip_code: '',
  currency: 'cad',
  ticket_tiers: [makeDefaultTier('Adult'), makeDefaultTier('Child')],
  seating_type: 'general_admission' as SeatingMode,
  seating_config: null,
  pass_processing_fee: false,
  charge_ticket_tax: false,
  refund_policy: 'non_refundable',
  show_remaining_seats: true,
  sponsor_logos: [],
  trailer_url: '',
  revenue_splits: [],
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

// ─── Seating Type Options ───────────────────────────────────────────────────
const SEATING_OPTIONS: {
  value: SeatingMode;
  label: string;
  description: string;
  icon: typeof MapPin;
}[] = [
  {
    value: 'general_admission',
    label: 'General Admission',
    description: 'No assigned seating. Customers buy tickets by tier (e.g. VIP, Regular, Student).',
    icon: Users,
  },
  {
    value: 'assigned_seating',
    label: 'Seat Based (No Map)',
    description:
      'Define seat ranges (e.g. A1-A20, B1-B30) and link to tiers. Customers get specific named seats.',
    icon: List,
  },
  {
    value: 'zone_admission',
    label: 'Zone Based (No Map)',
    description:
      'Define named zones with capacity and pricing. No venue map needed.',
    icon: LayoutGrid,
  },
  {
    value: 'zone_map',
    label: 'Zone Based Map',
    description:
      'Draw zones on a venue image. Customers pick a zone on the map.',
    icon: Map,
  },
  {
    value: 'seat_map',
    label: 'Seat Selection Map',
    description:
      'Place individual seats on a venue image. Customers pick exact seats.',
    icon: Armchair,
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────
interface OrganizerInfo {
  name: string;
  avatarUrl: string | null;
}

export default function CreateEventWizard({
  categories,
  existingEvent,
  organizer,
  defaultCurrency,
  stripeConnected = false,
}: {
  categories: Category[];
  existingEvent?: ExistingEvent;
  organizer?: OrganizerInfo;
  defaultCurrency?: string;
  stripeConnected?: boolean;
}) {
  const router = useRouter();
  const isEditing = !!existingEvent;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EventFormData>(() => {
    if (existingEvent) {
      const occs = (existingEvent.event_occurrences || []).map((o) => ({
        id: o.id,
        starts_at: o.starts_at,
        ends_at: o.ends_at,
        label: o.label || '',
      }));
      return {
        title: existingEvent.title,
        slug: existingEvent.slug,
        description: existingEvent.description,
        what_to_expect: existingEvent.what_to_expect?.length > 0 ? existingEvent.what_to_expect : [''],
        category_id: existingEvent.category_id,
        tags: existingEvent.tags,
        cover_image_url: existingEvent.cover_image_url,
        photo_urls: [],
        sales_start_at: existingEvent.sales_start_at || '',
        sales_end_at: existingEvent.sales_end_at || '',
        occurrences: occs.length > 0 ? occs : [{ ...DEFAULT_OCCURRENCE, id: crypto.randomUUID() }],
        location_type: existingEvent.location_type,
        venue_name: existingEvent.venue_name,
        address_text: existingEvent.address_text,
        city: existingEvent.city,
        zip_code: '',
        currency: existingEvent.currency,
        ticket_tiers:
          existingEvent.ticket_tiers.length > 0
            ? existingEvent.ticket_tiers
            : [makeDefaultTier('Adult', existingEvent.currency), makeDefaultTier('Child', existingEvent.currency)],
        seating_type: (existingEvent as ExistingEvent & { seating_type?: SeatingMode }).seating_type || 'general_admission',
        seating_config: (existingEvent as ExistingEvent & { seating_config?: SeatingConfig }).seating_config || null,
        pass_processing_fee: (existingEvent as ExistingEvent & { pass_processing_fee?: boolean }).pass_processing_fee || false,
        charge_ticket_tax: (existingEvent as ExistingEvent & { charge_ticket_tax?: boolean }).charge_ticket_tax || false,
        refund_policy: (existingEvent as ExistingEvent & { refund_policy?: string }).refund_policy as EventFormData['refund_policy'] || 'non_refundable',
        show_remaining_seats: (existingEvent as ExistingEvent & { show_remaining_seats?: boolean }).show_remaining_seats ?? true,
        sponsor_logos: (existingEvent as ExistingEvent & { sponsor_logos?: string[] }).sponsor_logos || [],
        trailer_url: (existingEvent as ExistingEvent & { trailer_url?: string }).trailer_url || '',
        revenue_splits: [],
      };
    }
    const currency = defaultCurrency || 'cad';
    return {
      ...INITIAL_FORM,
      currency,
      ticket_tiers: [makeDefaultTier('Adult', currency), makeDefaultTier('Child', currency)],
    };
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
        makeDefaultTier('', f.currency),
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

  const updateOccurrence = (
    index: number,
    field: keyof Occurrence,
    value: string
  ) => {
    setForm((f) => {
      const occs = [...f.occurrences];
      occs[index] = { ...occs[index], [field]: value };
      // Auto-default end to start + 1 hour when setting start and end is empty
      if (field === 'starts_at' && value && !occs[index].ends_at) {
        const d = new Date(value);
        d.setHours(d.getHours() + 1);
        const pad = (n: number) => n.toString().padStart(2, '0');
        occs[index].ends_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      return { ...f, occurrences: occs };
    });
  };

  const addOccurrence = () => {
    setForm((f) => ({
      ...f,
      occurrences: [
        ...f.occurrences,
        { ...DEFAULT_OCCURRENCE, id: crypto.randomUUID() },
      ],
    }));
  };

  const removeOccurrence = (index: number) => {
    if (form.occurrences.length <= 1) return;
    setForm((f) => ({
      ...f,
      occurrences: f.occurrences.filter((_, i) => i !== index),
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

  // Auto-generate ticket tiers from zone tiers for zone-based or map-based modes
  const handleSeatingConfigChange = (config: SeatingConfig) => {
    updateField('seating_config', config);

    const isZoneBased = form.seating_type === 'zone_admission' || form.seating_type === 'zone_map' || form.seating_type === 'seat_map';

    if (isZoneBased && config.zones) {
      const ticketTiers: TicketTier[] = [];

      for (const zone of config.zones) {
        const zoneTiers = zone.tiers && zone.tiers.length > 0
          ? zone.tiers
          : [{ id: zone.id, name: zone.name, price: zone.price || 0, initial_quantity: zone.initial_quantity || 100, max_per_order: zone.max_per_order || 10, description: zone.description || '', currency: zone.currency || form.currency }];

        for (const zt of zoneTiers) {
          // For seat_map mode, use actual seat count if available
          let quantity = zt.initial_quantity;
          if (form.seating_type === 'seat_map' && zoneTiers.length === 1) {
            const totalSeats = (zone.polygons || []).reduce(
              (sum, p) => sum + (p.seats?.length || 0), 0
            );
            if (totalSeats > 0) quantity = totalSeats;
          }

          // If zone has multiple tiers, prefix with zone name
          const tierName = zoneTiers.length > 1
            ? `${zone.name} — ${zt.name}`
            : zone.name;

          ticketTiers.push({
            id: zt.id,
            name: tierName,
            description: zt.description || '',
            price: zt.price || 0,
            currency: zt.currency || form.currency,
            initial_quantity: quantity,
            max_per_order: zt.max_per_order || 10,
            sales_start_at: '',
            sales_end_at: '',
            is_hidden: false,
          });
        }
      }

      if (ticketTiers.length > 0) {
        setForm((f) => ({ ...f, seating_config: config, ticket_tiers: ticketTiers }));
      }
    }
  };

  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!form.title.trim()) errs.title = 'Event title is required';
      if (!form.slug.trim()) errs.slug = 'Slug is required';
      if (form.what_to_expect.every((item) => !item.trim()))
        errs.what_to_expect = 'At least one "What to Expect" bullet is required';
      if (!form.category_id) errs.category_id = 'Category is required';
    }
    if (s === 1) {
      if (form.occurrences.length === 0) {
        errs.occurrences = 'At least one event occurrence is required';
      }
      form.occurrences.forEach((occ, i) => {
        if (!occ.starts_at) errs[`occ_${i}_starts_at`] = 'Start is required';
        if (!occ.ends_at) errs[`occ_${i}_ends_at`] = 'End is required';
        if (
          occ.starts_at &&
          occ.ends_at &&
          new Date(occ.ends_at) <= new Date(occ.starts_at)
        ) {
          errs[`occ_${i}_ends_at`] = 'End must be after start';
        }
      });
      if (
        form.sales_start_at &&
        form.sales_end_at &&
        new Date(form.sales_end_at) <= new Date(form.sales_start_at)
      ) {
        errs.sales_end_at = 'Sales end must be after sales start';
      }
      if (['physical', 'hybrid'].includes(form.location_type)) {
        if (!form.venue_name.trim()) errs.venue_name = 'Venue name is required';
        if (!form.address_text.trim()) errs.address_text = 'Full address is required';
        if (!form.city.trim()) errs.city = 'City is required';
        if (!form.zip_code.trim()) errs.zip_code = 'Postal code is required';
      }
    }
    if (s === 2) {
      // Validate based on seating type
      const isMapBased = form.seating_type === 'zone_map' || form.seating_type === 'seat_map';
      const isZoneAdmission = form.seating_type === 'zone_admission';

      if (isMapBased) {
        // Map-based modes: validate image + zones
        if (!form.seating_config?.image_url) {
          errs.seating_image = 'Please upload a venue image';
        }
        const zones = form.seating_config?.zones;
        if (!zones || zones.length === 0) {
          errs.seating_zones = 'Please draw at least one zone on the map';
        } else {
          zones.forEach((zone, i) => {
            if (!zone.name.trim()) errs[`zone_${i}_name`] = 'Zone name is required';
            const zoneTiers = zone.tiers && zone.tiers.length > 0
              ? zone.tiers
              : [{ price: zone.price ?? 0, initial_quantity: zone.initial_quantity ?? 0, name: zone.name }];
            zoneTiers.forEach((zt, j) => {
              if (!zt.name?.trim()) errs[`zone_${i}_tier_${j}_name`] = 'Tier name is required';
              if ((zt.price ?? 0) < 0) errs[`zone_${i}_tier_${j}_price`] = 'Price cannot be negative';
              if ((zt.initial_quantity ?? 0) <= 0) errs[`zone_${i}_tier_${j}_qty`] = 'Quantity must be > 0';
            });
            if (form.seating_type === 'seat_map') {
              const totalSeats = (zone.polygons || []).reduce(
                (sum, p) => sum + (p.seats?.length || 0), 0
              );
              if (totalSeats === 0) errs[`zone_${i}_seats`] = 'Generate seats for this zone';
            }
          });
        }
      } else if (isZoneAdmission) {
        // Zone admission (no map): validate zones exist and have valid tiers
        const zones = form.seating_config?.zones;
        if (!zones || zones.length === 0) {
          errs.seating_zones = 'Please define at least one zone';
        } else {
          zones.forEach((zone, i) => {
            if (!zone.name.trim()) errs[`zone_${i}_name`] = 'Zone name is required';
            const zoneTiers = zone.tiers && zone.tiers.length > 0
              ? zone.tiers
              : [{ price: zone.price ?? 0, initial_quantity: zone.initial_quantity ?? 0, name: zone.name }];
            zoneTiers.forEach((zt, j) => {
              if (!zt.name?.trim()) errs[`zone_${i}_tier_${j}_name`] = 'Tier name is required';
              if ((zt.price ?? 0) < 0) errs[`zone_${i}_tier_${j}_price`] = 'Price cannot be negative';
              if ((zt.initial_quantity ?? 0) <= 0) errs[`zone_${i}_tier_${j}_qty`] = 'Quantity must be > 0';
            });
          });
        }
      } else {
        // GA or Assigned Seating: validate tiers
        form.ticket_tiers.forEach((tier, i) => {
          if (!tier.name.trim()) errs[`tier_${i}_name`] = 'Tier name is required';
          if (tier.initial_quantity <= 0) errs[`tier_${i}_qty`] = 'Must be > 0';
          if (tier.price < 0) errs[`tier_${i}_price`] = 'Price cannot be negative';
          if (!tier.max_per_order || tier.max_per_order < 1) errs[`tier_${i}_max`] = 'Must be >= 1';
        });

        if (form.seating_type === 'assigned_seating') {
          if (!form.seating_config?.seat_ranges || form.seating_config.seat_ranges.length === 0) {
            errs.seating_zones = 'Please define at least one seat range';
          }
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const getSanitizedForm = () => {
    return {
      title: form.title,
      slug: form.slug,
      description: form.description,
      what_to_expect: form.what_to_expect.filter((p) => p.trim() !== ''),
      category_id: form.category_id,
      tags: form.tags,
      cover_image_url: form.cover_image_url,
      sales_start_at: form.sales_start_at,
      sales_end_at: form.sales_end_at,
      occurrences: form.occurrences,
      location_type: form.location_type,
      venue_name: form.venue_name,
      address_text: form.address_text,
      city: form.city,
      zip_code: form.zip_code,
      currency: form.currency,
      ticket_tiers: form.ticket_tiers,
      seating_type: form.seating_type,
      seating_config: form.seating_config as Record<string, unknown> | null,
      pass_processing_fee: form.pass_processing_fee,
      charge_ticket_tax: form.charge_ticket_tax,
      refund_policy: form.refund_policy,
      show_remaining_seats: form.show_remaining_seats,
      sponsor_logos: form.sponsor_logos,
      trailer_url: form.trailer_url,
    };
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      let eventIdForSplits: string | null = null;

      if (savedEventId || isEditing) {
        const idToUpdate = savedEventId || existingEvent?.id;
        if (idToUpdate) {
          const res = await updateEvent(idToUpdate, getSanitizedForm());
          if (!res.success) throw new Error(res.error);
          eventIdForSplits = idToUpdate;
        }
      } else {
        const res = await createEvent(getSanitizedForm());
        if (!res.success) throw new Error(res.error);
        setSavedEventId(res.data.id);
        eventIdForSplits = res.data.id;
      }

      // Save revenue splits
      if (eventIdForSplits && form.revenue_splits.length > 0) {
        await saveRevenueSplits(eventIdForSplits, form.revenue_splits);
      }

      setToast({
        message: isEditing || savedEventId ? 'Changes saved successfully' : 'Draft saved successfully',
        type: 'success',
      });
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      let idToPublish = savedEventId || existingEvent?.id;

      // Save changes first if no existing ID, or just to be safe it's up to date
      if (!idToPublish) {
        const res = await createEvent(getSanitizedForm());
        if (!res.success) throw new Error(res.error);
        idToPublish = res.data.id;
        setSavedEventId(idToPublish);
      } else {
        const res = await updateEvent(idToPublish, getSanitizedForm());
        if (!res.success) throw new Error(res.error);
      }

      // Save revenue splits
      if (form.revenue_splits.length > 0) {
        const splitsRes = await saveRevenueSplits(idToPublish, form.revenue_splits);
        if (!splitsRes.success) throw new Error(splitsRes.error);
      }

      // Now publish
      const pubRes = await publishEvent(idToPublish);
      if (!pubRes.success) throw new Error(pubRes.error);

      setToast({ message: 'Event published!', type: 'success' });

      // Redirect back to events list
      setTimeout(() => {
        router.push('/dashboard/events');
      }, 1500);

    } catch (err: any) {
      setToast({ message: err.message || 'Publish failed', type: 'error' });
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
              updateOccurrence={updateOccurrence}
              addOccurrence={addOccurrence}
              removeOccurrence={removeOccurrence}
            />
          )}
          {step === 2 && (
            <StepTicketsAndSeating
              form={form}
              errors={errors}
              updateField={updateField}
              updateTier={updateTier}
              addTier={addTier}
              removeTier={removeTier}
              onSeatingConfigChange={handleSeatingConfigChange}
              primaryOrganizerName={organizer?.name || 'You'}
            />
          )}
          {step === 3 && (
            <StepMedia
              form={form}
              updateField={updateField}
              setToast={setToast}
            />
          )}
          {step === 4 && (
            <StepReview form={form} categories={categories} stripeConnected={stripeConnected} />
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
            ) : existingEvent?.status === 'published' ? (
              <Button
                onClick={saveDraft}
                disabled={saving}
                className="gap-1.5 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
              >
                <Save className="size-4" />
                {saving ? 'Saving...' : 'Save Details'}
              </Button>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={publishing || !stripeConnected}
                className="gap-1.5 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                title={!stripeConnected ? 'Connect your Stripe account to publish' : undefined}
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
          <LivePreview form={form} categories={categories} organizer={organizer} />
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
  organizer,
}: {
  form: EventFormData;
  categories: Category[];
  organizer?: OrganizerInfo;
}) {
  const cat = categories.find((c) => c.id === form.category_id);
  const lowestPrice = useMemo(() => {
    const prices = form.ticket_tiers
      .filter((t) => t.name.trim())
      .map((t) => t.price);
    if (prices.length === 0) return null;
    return Math.min(...prices);
  }, [form.ticket_tiers]);

  const firstOcc = form.occurrences.find((o) => o.starts_at);
  const startDate = firstOcc ? new Date(firstOcc.starts_at) : null;
  const locationLabel =
    form.location_type === 'physical'
      ? 'In-Person'
      : form.location_type === 'virtual'
        ? 'Online'
        : 'Hybrid';

  const totalAvailability = useMemo(() => {
    return form.ticket_tiers
      .filter((t) => !t.is_hidden)
      .reduce((sum, t) => sum + (t.initial_quantity || 0), 0);
  }, [form.ticket_tiers]);

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
          style={{ background: 'rgba(249, 140, 31, 0.45)' }}
        />
        {/* Animated orange glow - inner layer */}
        <div
          className="absolute -inset-2 animate-float-glow-inner rounded-2xl blur-lg"
          style={{ background: 'rgba(249, 140, 31, 0.3)' }}
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
              <div className="flex h-full w-full items-center justify-center bg-white">
                <ImageIcon className="size-12 text-[#F98C1F]/60" />
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
            {(lowestPrice !== null || totalAvailability > 0) && (
              <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Ticket className="size-3.5 shrink-0 text-primary" />
                  {lowestPrice === 0
                    ? 'Free tickets available'
                    : `Tickets from $${lowestPrice?.toFixed(0) || 0}`}
                </div>
                {totalAvailability > 0 && (
                  <span className="text-xs font-medium text-foreground">
                    {totalAvailability} available
                  </span>
                )}
              </div>
            )}

            <Separator className="my-4" />

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {organizer?.avatarUrl ? (
                  <img
                    src={organizer.avatarUrl}
                    alt={organizer.name}
                    className="size-7 rounded-full border-2 border-card object-cover"
                  />
                ) : (
                  <div className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-[11px] font-bold text-primary-foreground">
                    {(organizer?.name || 'O').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-foreground">
                  {organizer?.name || 'Organizer'}
                </span>
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

        <FormField label="Description" required>
          <Textarea
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={4}
            placeholder="Tell attendees what to expect, what they'll learn, who should come..."
            className="resize-none"
          />
        </FormField>

        <FormField
          label="What to Expect"
          required
          hint="Add bullet points describing what attendees will experience"
          error={errors.what_to_expect}
        >
          <div className="space-y-2">
            {form.what_to_expect.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  •
                </span>
                <Input
                  value={item}
                  onChange={(e) => {
                    const updated = [...form.what_to_expect];
                    updated[idx] = e.target.value;
                    updateField('what_to_expect', updated);
                  }}
                  placeholder={`Bullet point ${idx + 1}`}
                  className="h-10 flex-1"
                />
                {form.what_to_expect.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = form.what_to_expect.filter((_, i) => i !== idx);
                      updateField('what_to_expect', updated);
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove bullet"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateField('what_to_expect', [...form.what_to_expect, ''])}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="size-3.5" />
              Add bullet point
            </button>
          </div>
        </FormField>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <FormField label="Category" required error={errors.category_id}>
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
  updateOccurrence,
  addOccurrence,
  removeOccurrence,
}: {
  form: EventFormData;
  errors: Record<string, string>;
  updateField: <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => void;
  updateOccurrence: (index: number, field: keyof Occurrence, value: string) => void;
  addOccurrence: () => void;
  removeOccurrence: (index: number) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="When & Where"
        description="Add one or more event dates, set an optional ticket sales window, and configure the venue."
      />

      <div className="space-y-8">
        {/* Event Occurrences */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground">
                Event Dates <span className="ml-0.5 text-primary">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When the event actually takes place. Add multiple dates for recurring events.
              </p>
            </div>
            <Button
              onClick={addOccurrence}
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
            >
              <Plus className="size-3.5" />
              Add Date
            </Button>
          </div>
          {errors.occurrences && (
            <p className="text-xs font-medium text-destructive mb-3">{errors.occurrences}</p>
          )}
          <div className="space-y-3">
            {form.occurrences.map((occ, i) => (
              <div
                key={occ.id}
                className="relative rounded-xl border border-border bg-card p-5"
              >
                {form.occurrences.length > 1 && (
                  <Button
                    onClick={() => removeOccurrence(i)}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                  Date {i + 1}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    label="Starts At"
                    error={errors[`occ_${i}_starts_at`]}
                    required
                  >
                    <Input
                      type="datetime-local"
                      value={occ.starts_at}
                      onChange={(e) => updateOccurrence(i, 'starts_at', e.target.value)}
                      aria-invalid={!!errors[`occ_${i}_starts_at`]}
                      className="h-11"
                    />
                  </FormField>
                  <FormField
                    label="Ends At"
                    error={errors[`occ_${i}_ends_at`]}
                    required
                  >
                    <Input
                      type="datetime-local"
                      value={occ.ends_at}
                      min={occ.starts_at || undefined}
                      onChange={(e) => updateOccurrence(i, 'ends_at', e.target.value)}
                      aria-invalid={!!errors[`occ_${i}_ends_at`]}
                      className="h-11"
                    />
                  </FormField>
                  <FormField label="Label" hint="e.g. Day 1, Morning Show">
                    <Input
                      value={occ.label}
                      onChange={(e) => updateOccurrence(i, 'label', e.target.value)}
                      placeholder="Optional label"
                      className="h-11"
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Window */}
        <div className="rounded-xl border border-border bg-card p-6">
          <Label className="text-sm font-medium text-foreground mb-1 block">
            Ticket Sales Window
          </Label>
          <p className="text-xs text-muted-foreground mb-4">
            Optionally set when ticket sales open and close. Leave blank to sell until each occurrence starts.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Sales Open" error={errors.sales_start_at}>
              <Input
                type="datetime-local"
                value={form.sales_start_at}
                onChange={(e) => updateField('sales_start_at', e.target.value)}
                className="h-11"
              />
            </FormField>
            <FormField label="Sales Close" error={errors.sales_end_at}>
              <Input
                type="datetime-local"
                value={form.sales_end_at}
                onChange={(e) => updateField('sales_end_at', e.target.value)}
                className="h-11"
              />
            </FormField>
          </div>
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
              <FormField
                label="Full Address"
                error={errors.address_text}
                required
              >
                <AddressAutocomplete
                  value={form.address_text}
                  onChange={(val) => updateField('address_text', val)}
                  onSelect={(result) => {
                    if (result.city) updateField('city', result.city);
                    if (result.postalCode) updateField('zip_code', result.postalCode);
                  }}
                  placeholder="Start typing address..."
                  error={!!errors.address_text}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="City" error={errors.city} required>
                  <Input
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder="e.g. Toronto"
                    aria-invalid={!!errors.city}
                    className="h-11"
                  />
                </FormField>
                <FormField
                  label="Postal Code"
                  error={errors.zip_code}
                  required
                >
                  <Input
                    value={form.zip_code}
                    onChange={(e) => updateField('zip_code', e.target.value)}
                    placeholder="e.g. M5V 1J2"
                    aria-invalid={!!errors.zip_code}
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

// ─── Step 3: Tickets & Seating (Combined) ───────────────────────────────────

function TierCards({
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
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Ticket Tiers
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
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
                error={errors[`tier_${i}_price`]}
                required
              >
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.price}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateTier(i, 'price', val === '' ? 0 : parseFloat(val));
                  }}
                  aria-invalid={!!errors[`tier_${i}_price`]}
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
              <FormField
                label="Max Per Order"
                error={errors[`tier_${i}_max`]}
                required
              >
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
                  aria-invalid={!!errors[`tier_${i}_max`]}
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

function StepTicketsAndSeating({
  form,
  errors,
  updateField,
  updateTier,
  addTier,
  removeTier,
  onSeatingConfigChange,
  primaryOrganizerName,
}: {
  form: EventFormData;
  errors: Record<string, string>;
  updateField: <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => void;
  updateTier: (
    i: number,
    field: keyof TicketTier,
    value: string | number | boolean
  ) => void;
  addTier: () => void;
  removeTier: (i: number) => void;
  onSeatingConfigChange: (config: SeatingConfig) => void;
  primaryOrganizerName: string;
}) {
  const { uploading, error: uploadError, uploadImage } = useImageUpload();
  const [imageUrl, setImageUrl] = useState(form.seating_config?.image_url ?? null);
  const [imageWidth, setImageWidth] = useState(form.seating_config?.image_width ?? 0);
  const [imageHeight, setImageHeight] = useState(form.seating_config?.image_height ?? 0);
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadImage(file);
    if (result) {
      setImageUrl(result.url);
      setImageWidth(result.width);
      setImageHeight(result.height);
    }
  }

  function handleZoneListChange(zones: ZoneDefinition[]) {
    const config: SeatingConfig = {
      image_url: null,
      image_width: 0,
      image_height: 0,
      view_mode: 'schematic',
      zones,
    };
    onSeatingConfigChange(config);
  }

  return (
    <div>
      <SectionHeader
        title="Tickets & Seating"
        description="Choose a seating arrangement and configure your ticket tiers."
      />

      <div className="space-y-8">
        {/* ─── Seating Mode Selector ─────────────────────────────────────── */}
        <div>
          <Label className="text-sm font-medium text-foreground mb-3 block">
            Seating Mode
          </Label>
          <div className="grid grid-cols-1 gap-3">
            {SEATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                  form.seating_type === opt.value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                )}
                onClick={() => updateField('seating_type', opt.value)}
              >
                <div className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  form.seating_type === opt.value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  <opt.icon className="size-4.5" />
                </div>
                <div>
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* ─── General Admission: Tier Cards ────────────────────────────── */}
        {form.seating_type === 'general_admission' && (
          <TierCards
            form={form}
            errors={errors}
            updateTier={updateTier}
            addTier={addTier}
            removeTier={removeTier}
          />
        )}

        {/* ─── Assigned Seating: Tier Cards + Seat Range Editor ─────────── */}
        {form.seating_type === 'assigned_seating' && (
          <>
            <TierCards
              form={form}
              errors={errors}
              updateTier={updateTier}
              addTier={addTier}
              removeTier={removeTier}
            />
            <Separator />
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Seat Ranges
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Define seat ranges and assign them to ticket tiers. Customers will be assigned a seat from the range.
                </p>
              </div>
              {errors.seating_zones && (
                <p className="text-xs font-medium text-destructive mb-3">{errors.seating_zones}</p>
              )}
              <SeatRangeEditor
                tiers={form.ticket_tiers.map((t) => ({ id: t.id, name: t.name }))}
                initialConfig={form.seating_config}
                onChange={onSeatingConfigChange}
              />
            </div>
          </>
        )}

        {/* ─── Zone Admission: Zone List Editor (no map) ───────────────── */}
        {form.seating_type === 'zone_admission' && (
          <>
            {errors.seating_zones && (
              <p className="text-xs font-medium text-destructive">{errors.seating_zones}</p>
            )}
            <ZoneListEditor
              zones={form.seating_config?.zones ?? []}
              onChange={handleZoneListChange}
              currency={form.currency}
            />
          </>
        )}

        {/* ─── Map-Based Seating: Image Upload + Designer + Tiers ────────── */}
        {(form.seating_type === 'zone_map' || form.seating_type === 'seat_map') && (
          <>
            {errors.seating_image && (
              <p className="text-xs font-medium text-destructive">{errors.seating_image}</p>
            )}
            {errors.seating_zones && (
              <p className="text-xs font-medium text-destructive">{errors.seating_zones}</p>
            )}

            {/* Venue Image Upload */}
            <div className="space-y-2">
              <Label>Venue Image</Label>
              {!imageUrl ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Click to upload venue image'}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, or WebP (max 5MB)
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              ) : (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Venue"
                    className="w-full h-32 object-cover rounded-xl border border-border"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImageUrl(null);
                      setImageWidth(0);
                      setImageHeight(0);
                    }}
                  >
                    Change Image
                  </Button>
                </div>
              )}
              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}</p>
              )}
            </div>

            {/* Seat Map Designer (canvas + zone panel side by side) */}
            {imageUrl && (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {form.seating_type === 'zone_map' ? 'Zone Map Editor' : 'Seat Map Editor'}
                    </h3>
                    <Badge variant="outline" className="text-[10px]">
                      {form.seating_type === 'zone_map' ? 'Zone Only' : 'Individual Seating'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {form.seating_type === 'zone_map'
                      ? 'Draw zones on the image using polygon or rectangle tools. Each zone becomes a tier with its own price and quantity. Edit zone properties in the right panel.'
                      : 'Draw zones, then generate a seat grid within each zone. Each seat gets a label (e.g. A1, B3). Customers will pick a specific seat. Edit zone/tier properties in the right panel.'}
                  </p>
                  <SeatmapDesigner
                    mode="zone"
                    imageUrl={imageUrl}
                    imageWidth={imageWidth}
                    imageHeight={imageHeight}
                    initialConfig={form.seating_config ?? undefined}
                    onChange={onSeatingConfigChange}
                    currency={form.currency}
                    showSeatPlacer={form.seating_type === 'seat_map'}
                  />
                </div>

                {/* Generated Tiers Summary (grouped by zone) */}
                {form.seating_config?.zones && form.seating_config.zones.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Ticket className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Generated Tiers ({form.ticket_tiers.length})
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Tiers are auto-generated from zones. Each zone can have multiple ticket types. Edit in the zone properties panel.
                    </p>
                    <div className="space-y-3">
                      {form.seating_config.zones.map((zone) => {
                        const zoneTiers = zone.tiers && zone.tiers.length > 0
                          ? zone.tiers
                          : [{ id: zone.id, name: zone.name, price: zone.price || 0, initial_quantity: zone.initial_quantity || 0 }];
                        return (
                          <div key={zone.id}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className="size-3 rounded-full shrink-0"
                                style={{ backgroundColor: zone.color }}
                              />
                              <span className="text-sm font-medium text-foreground">
                                {zone.name || 'Unnamed Zone'}
                              </span>
                              {zoneTiers.length > 1 && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({zoneTiers.length} tiers)
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 ml-5">
                              {zoneTiers.map((zt) => (
                                <div
                                  key={zt.id}
                                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
                                >
                                  <span className="text-xs text-muted-foreground">
                                    {zt.name || 'Unnamed'}
                                  </span>
                                  <div className="text-right">
                                    <span className="text-xs font-semibold text-foreground tabular-nums">
                                      {zt.price === 0 ? 'Free' : `$${zt.price.toFixed(2)}`}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground tabular-nums ml-2">
                                      {zt.initial_quantity} {form.seating_type === 'seat_map' ? 'seats' : 'qty'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total capacity</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {form.ticket_tiers.reduce((sum, t) => sum + (t.initial_quantity || 0), 0)}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ─── Convenience Fee Option ──────────────────────────────── */}
        <Separator />
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Convenience Fee</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Choose who pays the convenience fee (3.5% + $1.50/ticket).
          </p>
          <div className="space-y-2">
            <button
              type="button"
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all w-full ${
                !form.pass_processing_fee
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
              }`}
              onClick={() => updateField('pass_processing_fee', false)}
            >
              <div className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5 ${
                !form.pass_processing_fee ? 'border-primary bg-primary' : 'border-muted-foreground/30'
              }`}>
                {!form.pass_processing_fee && (
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <div>
                <div className="font-medium text-sm">I&apos;ll absorb the convenience fee</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  The convenience fee (3.5% + $1.50/ticket) comes from your revenue. Attendees see only the ticket price.
                </div>
              </div>
            </button>
            <button
              type="button"
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all w-full ${
                form.pass_processing_fee
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30'
              }`}
              onClick={() => updateField('pass_processing_fee', true)}
            >
              <div className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5 ${
                form.pass_processing_fee ? 'border-primary bg-primary' : 'border-muted-foreground/30'
              }`}>
                {form.pass_processing_fee && (
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <div>
                <div className="font-medium text-sm">Pass convenience fee to attendee</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  The convenience fee is shown as a separate line item at checkout. You receive the full ticket price.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ─── Sales Tax ──────────────────────────────────────────── */}
        <Separator />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Sales Tax</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Enable to automatically charge the applicable sales tax on ticket prices.
              The correct rate (GST/HST/PST) is determined automatically based on the event and buyer location via Stripe Tax.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                form.charge_ticket_tax ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
              onClick={() => updateField('charge_ticket_tax', !form.charge_ticket_tax)}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  form.charge_ticket_tax ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-foreground">
              {form.charge_ticket_tax ? 'Automatic sales tax on tickets' : 'No sales tax on tickets'}
            </span>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Note:</span> The platform convenience fee will always include 13% HST regardless of this setting.
            </p>
          </div>
        </div>

        {/* ─── Refund Policy ──────────────────────────────────────────── */}
        <Separator />
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Refund Policy</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Choose a refund policy for this event. This will be shown to attendees before purchase.
          </p>
          <div className="space-y-2">
            {([
              { value: 'fully_refundable' as const, label: 'Fully Refundable', desc: 'Attendees can request a full refund at any time before the event.' },
              { value: 'non_refundable' as const, label: 'Non-Refundable', desc: 'No refunds will be issued. All sales are final.' },
              { value: 'partial_refundable' as const, label: 'Refundable After Contacting Organizer', desc: 'Attendees must contact the organizer to request a refund. Refunds are at the organizer\'s discretion.' },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all w-full ${
                  form.refund_policy === opt.value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
                onClick={() => updateField('refund_policy', opt.value)}
              >
                <div className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5 ${
                  form.refund_policy === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                }`}>
                  {form.refund_policy === opt.value && (
                    <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Show Remaining Seats ─────────────────────────────────────── */}
        <Separator />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Show Remaining Tickets</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When enabled, attendees will see how many tickets are left for each tier (e.g. &quot;12 remaining&quot;). Disable to hide this information.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                form.show_remaining_seats ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
              onClick={() => updateField('show_remaining_seats', !form.show_remaining_seats)}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  form.show_remaining_seats ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-foreground">
              {form.show_remaining_seats ? 'Show remaining ticket count to attendees' : 'Hide remaining ticket count'}
            </span>
          </div>
        </div>

        {/* ─── Revenue Splits ──────────────────────────────────────────── */}
        <Separator />
        <RevenueSplitsEditor
          splits={form.revenue_splits}
          onSplitsChange={(splits) => updateField('revenue_splits', splits)}
          primaryOrganizerName={primaryOrganizerName}
          primaryOrganizerPercentage={
            100 - form.revenue_splits.reduce((sum, s) => sum + s.percentage, 0)
          }
        />
      </div>
    </div>
  );
}

import { uploadEventCoverImage, uploadEventGalleryImage, uploadSponsorLogo } from '@/lib/actions';

// ─── Step 4: Media ──────────────────────────────────────────────────────────
function StepMedia({
  form,
  updateField,
  setToast,
}: {
  form: EventFormData;
  updateField: <K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) => void;
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const sponsorInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingSponsor, setIsUploadingSponsor] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);
  const [isDraggingSponsor, setIsDraggingSponsor] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Cover image must be under 5 MB', type: 'error' });
      return;
    }

    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('cover_image', file);

      const res = await uploadEventCoverImage(formData);
      if (res.success) {
        updateField('cover_image_url', res.data.cover_image_url);
        setToast({ message: 'Cover image uploaded', type: 'success' });
      } else {
        setToast({ message: res.error, type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Upload failed', type: 'error' });
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleCoverDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Cover image must be under 5 MB', type: 'error' });
      return;
    }
    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('cover_image', file);
      const res = await uploadEventCoverImage(formData);
      if (res.success) {
        updateField('cover_image_url', res.data.cover_image_url);
        setToast({ message: 'Cover image uploaded', type: 'success' });
      } else {
        setToast({ message: res.error, type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Upload failed', type: 'error' });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files) return;

    setIsUploadingGallery(true);
    try {
      const newUrls: string[] = [];
      const MAX_FILE_SIZE = 5 * 1024 * 1024;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_FILE_SIZE) {
          setToast({ message: `File ${file.name} is too large (> 5MB)`, type: 'error' });
          continue;
        }

        const formData = new FormData();
        formData.append('gallery_image', file);

        const res = await uploadEventGalleryImage(formData);
        if (res.success) {
          newUrls.push(res.data.photo_url);
        } else {
          setToast({ message: res.error, type: 'error' });
        }
      }

      if (newUrls.length > 0) {
        updateField('photo_urls', [...form.photo_urls, ...newUrls]);
        setToast({ message: `Successfully uploaded ${newUrls.length} image(s)`, type: 'success' });
      }

    } catch (err: any) {
      setToast({ message: err.message || 'Gallery upload failed', type: 'error' });
    } finally {
      setIsUploadingGallery(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const removePhoto = (idx: number) => {
    updateField('photo_urls', form.photo_urls.filter((_, i) => i !== idx));
  };

  const handleSponsorFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingSponsor(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('sponsor_logo', file);
        const res = await uploadSponsorLogo(fd);
        if (res.success) {
          newUrls.push(res.data.logo_url);
        } else {
          setToast({ message: res.error, type: 'error' });
        }
      }
      if (newUrls.length > 0) {
        updateField('sponsor_logos', [...form.sponsor_logos, ...newUrls]);
        setToast({ message: `Uploaded ${newUrls.length} sponsor logo(s)`, type: 'success' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Sponsor logo upload failed', type: 'error' });
    } finally {
      setIsUploadingSponsor(false);
      if (sponsorInputRef.current) sponsorInputRef.current.value = '';
    }
  };

  const removeSponsorLogo = (idx: number) => {
    updateField('sponsor_logos', form.sponsor_logos.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <SectionHeader
        title="Event Media"
        description="Add a cover image and upload photos to showcase your event."
      />

      <div className="space-y-8">
        {/* Cover Image */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">Cover Image</p>
          <FormField
            label="Upload Cover Image"
            hint="Recommended size: 1200 x 630px. Max 5MB (JPEG, PNG, WebP)"
          >
            <div className="flex gap-3 items-center">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                disabled={isUploadingCover}
                className="h-11 cursor-pointer flex-1"
              />
              {isUploadingCover && (
                <span className="text-sm text-muted-foreground animate-pulse whitespace-nowrap">
                  Uploading...
                </span>
              )}
            </div>
            <div className="text-center text-xs text-muted-foreground mt-2 font-medium">
              — OR —
            </div>
          </FormField>
          <FormField
            label="Cover Image URL"
            hint="Paste a direct image URL if you prefer not to upload."
          >
            <Input
              value={form.cover_image_url}
              onChange={(e) => updateField('cover_image_url', e.target.value)}
              placeholder="https://example.com/my-event-banner.jpg"
              className="h-11"
              disabled={isUploadingCover}
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
            <div
              className={cn(
                "flex h-56 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors",
                isDraggingCover
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
              onDragEnter={(e) => { e.preventDefault(); setIsDraggingCover(true); }}
              onDragLeave={() => setIsDraggingCover(false)}
              onDrop={handleCoverDrop}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
                <Upload className="size-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {isDraggingCover ? 'Drop image here' : 'No image yet'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isDraggingCover ? 'Release to upload' : 'Drag & drop or paste a URL above'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <Separator />

        {/* Photo Gallery Upload */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Photo Gallery</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Upload photos that will appear in your event page gallery.
              </p>
            </div>
            {form.photo_urls.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => photoInputRef.current?.click()}
              >
                <Plus className="size-3.5" />
                Add More
              </Button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handlePhotoFiles(e.target.files)}
          />

          {form.photo_urls.length === 0 ? (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingGallery}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                isDraggingGallery
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/50 hover:border-primary/40 hover:bg-primary/5"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingGallery(true); }}
              onDragEnter={(e) => { e.preventDefault(); setIsDraggingGallery(true); }}
              onDragLeave={() => setIsDraggingGallery(false)}
              onDrop={(e) => { e.preventDefault(); setIsDraggingGallery(false); handlePhotoFiles(e.dataTransfer.files); }}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
                <ImageIcon className="size-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {isUploadingGallery ? 'Uploading...' : isDraggingGallery ? 'Drop images here' : 'Upload photos'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isUploadingGallery ? 'Please wait' : isDraggingGallery ? 'Release to upload' : 'Drag & drop or click to browse — JPG, PNG, WebP supported'}
                </p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {form.photo_urls.map((url, idx) => (
                <div
                  key={url}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <img
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 shadow transition-opacity group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    <X className="size-3.5" />
                  </button>
                  <div className="absolute bottom-1.5 left-1.5 rounded-md bg-foreground/60 px-1.5 py-0.5 text-[10px] font-medium text-background">
                    {idx + 1}
                  </div>
                </div>
              ))}
              {/* Add more tile */}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingGallery}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  isDraggingGallery
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingGallery(true); }}
                onDragEnter={(e) => { e.preventDefault(); setIsDraggingGallery(true); }}
                onDragLeave={() => setIsDraggingGallery(false)}
                onDrop={(e) => { e.preventDefault(); setIsDraggingGallery(false); handlePhotoFiles(e.dataTransfer.files); }}
              >
                <Plus className="size-5" />
                <span className="text-xs font-medium">
                  {isUploadingGallery ? 'Uploading...' : isDraggingGallery ? 'Drop here' : 'Add More'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <Separator />

        {/* Sponsor Logos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Sponsor Logos</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Optional. Upload sponsor logos to display on your event page.
              </p>
            </div>
            {form.sponsor_logos.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => sponsorInputRef.current?.click()}
              >
                <Plus className="size-3.5" />
                Add More
              </Button>
            )}
          </div>

          <input
            ref={sponsorInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleSponsorFiles(e.target.files)}
          />

          {form.sponsor_logos.length === 0 ? (
            <button
              type="button"
              onClick={() => sponsorInputRef.current?.click()}
              disabled={isUploadingSponsor}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                isDraggingSponsor
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/50 hover:border-primary/40 hover:bg-primary/5"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingSponsor(true); }}
              onDragEnter={(e) => { e.preventDefault(); setIsDraggingSponsor(true); }}
              onDragLeave={() => setIsDraggingSponsor(false)}
              onDrop={(e) => { e.preventDefault(); setIsDraggingSponsor(false); handleSponsorFiles(e.dataTransfer.files); }}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
                <ImageIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {isUploadingSponsor ? 'Uploading...' : isDraggingSponsor ? 'Drop logos here' : 'Upload sponsor logos'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isUploadingSponsor ? 'Please wait' : isDraggingSponsor ? 'Release to upload' : 'Drag & drop or click — JPG, PNG, WebP, SVG — max 2 MB each'}
                </p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {form.sponsor_logos.map((url, idx) => (
                <div
                  key={url}
                  className="group relative aspect-[3/2] overflow-hidden rounded-xl border border-border bg-white flex items-center justify-center p-2"
                >
                  <img
                    src={url}
                    alt={`Sponsor ${idx + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => removeSponsorLogo(idx)}
                    className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 shadow transition-opacity group-hover:opacity-100"
                    aria-label="Remove sponsor logo"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => sponsorInputRef.current?.click()}
                disabled={isUploadingSponsor}
                className={cn(
                  "flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  isDraggingSponsor
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingSponsor(true); }}
                onDragEnter={(e) => { e.preventDefault(); setIsDraggingSponsor(true); }}
                onDragLeave={() => setIsDraggingSponsor(false)}
                onDrop={(e) => { e.preventDefault(); setIsDraggingSponsor(false); handleSponsorFiles(e.dataTransfer.files); }}
              >
                <Plus className="size-5" />
                <span className="text-xs font-medium">
                  {isUploadingSponsor ? 'Uploading...' : isDraggingSponsor ? 'Drop here' : 'Add More'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <Separator />

        {/* Video / Trailer Embed */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Video / Trailer</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Optional. Paste a YouTube or Vimeo URL to embed a trailer on your event page.
            </p>
          </div>

          <FormField
            label="Video URL"
            hint="Supports YouTube and Vimeo links (e.g. https://www.youtube.com/watch?v=... or https://vimeo.com/...)"
          >
            <Input
              value={form.trailer_url}
              onChange={(e) => updateField('trailer_url', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="h-11"
            />
          </FormField>

          {form.trailer_url && (() => {
            const url = form.trailer_url.trim();
            let embedUrl = '';
            // YouTube
            const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
            if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            // Vimeo
            const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
            if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;

            if (embedUrl) {
              return (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={embedUrl}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video preview"
                    />
                  </div>
                </div>
              );
            }
            return (
              <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50">
                <p className="text-sm font-medium text-amber-700">Could not detect a valid video URL</p>
                <p className="text-xs text-amber-600">Paste a YouTube or Vimeo link above</p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Review ─────────────────────────────────────────────────────────
function StepReview({
  form,
  categories,
  stripeConnected = false,
}: {
  form: EventFormData;
  categories: Category[];
  stripeConnected?: boolean;
}) {
  const cat = categories.find((c) => c.id === form.category_id);
  const totalTickets = form.ticket_tiers.reduce(
    (sum, t) => sum + t.initial_quantity,
    0
  );

  const seatingLabel =
    form.seating_type === 'general_admission'
      ? 'General Admission'
      : form.seating_type === 'assigned_seating'
        ? 'Seat Based (No Map)'
        : form.seating_type === 'zone_admission'
          ? 'Zone Based (No Map)'
          : form.seating_type === 'zone_map'
            ? 'Zone Based Map'
            : 'Seat Selection Map';

  return (
    <div>
      <SectionHeader
        title="Review Your Event"
        description="Make sure everything looks good before publishing."
      />

      {!stripeConnected && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Stripe account not connected
            </p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
              Connect your Stripe account to publish this event. You can save it as a draft for now.{' '}
              <a href="/dashboard/payments" className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
                Go to Payments
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <ReviewCard title="Event Basics" icon={FileText}>
          <ReviewRow label="Title" value={form.title || '\u2014'} />
          <ReviewRow label="Slug" value={form.slug || '\u2014'} />
          <ReviewRow label="Category" value={cat?.name || 'None'} />
          <ReviewRow label="Tags" value={form.tags.join(', ') || 'None'} />
        </ReviewCard>

        <ReviewCard title="Event Dates" icon={Calendar}>
          {form.occurrences.map((occ, i) => (
            <div key={occ.id} className="py-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {occ.label || `Date ${i + 1}`}
                </span>
                <span className="font-medium text-foreground">
                  {occ.starts_at ? new Date(occ.starts_at).toLocaleString() : '\u2014'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">to</span>
                <span className="text-xs text-foreground">
                  {occ.ends_at ? new Date(occ.ends_at).toLocaleString() : '\u2014'}
                </span>
              </div>
            </div>
          ))}
          {(form.sales_start_at || form.sales_end_at) && (
            <>
              <Separator className="my-2" />
              <ReviewRow
                label="Sales Open"
                value={form.sales_start_at ? new Date(form.sales_start_at).toLocaleString() : '\u2014'}
              />
              <ReviewRow
                label="Sales Close"
                value={form.sales_end_at ? new Date(form.sales_end_at).toLocaleString() : '\u2014'}
              />
            </>
          )}
        </ReviewCard>

        <ReviewCard title="Venue" icon={MapPin}>
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

        <ReviewCard title="Seating" icon={MapPin}>
          <ReviewRow label="Type" value={seatingLabel} />
          {(form.seating_type === 'zone_admission' || form.seating_type === 'zone_map' || form.seating_type === 'seat_map') && form.seating_config?.zones && (
            <>
              <ReviewRow
                label="Zones"
                value={`${form.seating_config.zones.length} zone${form.seating_config.zones.length !== 1 ? 's' : ''}`}
              />
              {form.seating_config.zones.some((z) => z.tiers && z.tiers.length > 1) && (
                <ReviewRow
                  label="Multi-tier zones"
                  value={`${form.seating_config.zones.filter((z) => z.tiers && z.tiers.length > 1).length}`}
                />
              )}
            </>
          )}
          {form.seating_type === 'assigned_seating' && form.seating_config?.seat_ranges && (
            <ReviewRow
              label="Seat Ranges"
              value={`${form.seating_config.seat_ranges.length} range${form.seating_config.seat_ranges.length !== 1 ? 's' : ''}`}
            />
          )}
        </ReviewCard>

        {form.revenue_splits.length > 0 && (
          <ReviewCard title="Revenue Splits" icon={Users}>
            {form.revenue_splits.map((split) => (
              <div
                key={split.id}
                className="flex justify-between py-1.5 text-sm"
              >
                <span className="text-muted-foreground">
                  {split.recipientName}
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {split.percentage}%
                </span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between text-sm font-bold text-foreground">
              <span>Primary organizer</span>
              <span className="tabular-nums">
                {100 - form.revenue_splits.reduce((sum, s) => sum + s.percentage, 0)}%
              </span>
            </div>
          </ReviewCard>
        )}

        <div className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-3">Fee & Policy Settings</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Convenience fee</span>
            <span>{form.pass_processing_fee ? 'Passed to attendee' : 'Absorbed by you'}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-muted-foreground">Sales Tax</span>
            <span>{form.charge_ticket_tax ? 'Automatic (location-based)' : 'Not charging'}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Refund Policy</span>
            <span>{form.refund_policy === 'fully_refundable' ? 'Fully Refundable' : form.refund_policy === 'non_refundable' ? 'Non-Refundable' : 'Contact Organizer'}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-muted-foreground">Show Remaining Tickets</span>
            <span>{form.show_remaining_seats ? 'Visible' : 'Hidden'}</span>
          </div>
        </div>

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

        {form.trailer_url && (
          <ReviewCard title="Video / Trailer" icon={Eye}>
            <p className="text-sm text-muted-foreground truncate">{form.trailer_url}</p>
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
