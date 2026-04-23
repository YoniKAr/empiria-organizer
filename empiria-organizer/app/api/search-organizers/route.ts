import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('id, auth0_id, full_name, email, stripe_account_id, organizer_code')
    .eq('role', 'organizer')
    .not('stripe_account_id', 'is', null)
    .or(`email.ilike.%${q}%,full_name.ilike.%${q}%,organizer_code.eq.${q.toUpperCase()}`)
    .limit(10);

  return NextResponse.json({ results: data || [] });
}
