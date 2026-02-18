import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import CreateEventWizard from './CreateEventWizard';

interface PageProps {
  searchParams: Promise<{ edit?: string }>;
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export default async function CreateEventPage({ searchParams }: PageProps) {
  const { edit: editEventId } = await searchParams;
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=/dashboard/events/create');

  const supabase = getSupabaseAdmin();

  // Gate: Stripe must be connected before creating events
  const { data: user } = await supabase
    .from('users')
    .select('stripe_onboarding_completed')
    .eq('auth0_id', session.user.sub)
    .single();

  if (!user?.stripe_onboarding_completed) {
    redirect('/dashboard/payments?reason=stripe_required');
  }

  // Fetch categories for the dropdown
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name');

  // If editing, fetch existing event + tiers
  let existingEvent = undefined;
  if (editEventId) {
    const { data: event } = await supabase
      .from('events')
      .select(`
        id, title, slug, description, category_id, tags,
        cover_image_url, start_at, end_at, location_type,
        venue_name, address_text, city, currency, status, organizer_id
      `)
      .eq('id', editEventId)
      .single();

    if (!event || event.organizer_id !== session.user.sub) {
      redirect('/dashboard/events');
    }

    const { data: tiers } = await supabase
      .from('ticket_tiers')
      .select('id, name, description, price, currency, initial_quantity, remaining_quantity, max_per_order, sales_start_at, sales_end_at, is_hidden')
      .eq('event_id', editEventId)
      .order('price', { ascending: true });

    // Parse description JSON → plain text
    let descriptionText = '';
    if (event.description) {
      try {
        const parsed = typeof event.description === 'string'
          ? JSON.parse(event.description)
          : event.description;
        descriptionText = parsed?.text || '';
      } catch {
        descriptionText = '';
      }
    }

    existingEvent = {
      id: event.id,
      title: event.title,
      slug: event.slug,
      description: descriptionText,
      category_id: event.category_id || '',
      tags: event.tags || [],
      cover_image_url: event.cover_image_url || '',
      start_at: toDatetimeLocal(event.start_at),
      end_at: toDatetimeLocal(event.end_at),
      location_type: (event.location_type || 'physical') as 'physical' | 'virtual' | 'hybrid',
      venue_name: event.venue_name || '',
      address_text: event.address_text || '',
      city: event.city || '',
      currency: event.currency || 'cad',
      status: event.status,
      ticket_tiers: (tiers || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        price: Number(t.price),
        currency: t.currency || 'cad',
        initial_quantity: t.initial_quantity,
        max_per_order: t.max_per_order || 10,
        sales_start_at: toDatetimeLocal(t.sales_start_at),
        sales_end_at: toDatetimeLocal(t.sales_end_at),
        is_hidden: t.is_hidden || false,
      })),
    };
  }

  return <CreateEventWizard categories={categories || []} existingEvent={existingEvent} />;
}
