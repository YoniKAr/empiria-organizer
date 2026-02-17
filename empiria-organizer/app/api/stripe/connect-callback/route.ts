import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    const status = req.nextUrl.searchParams.get('status');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://organizer.empiriaindia.com';
    const supabase = getSupabaseAdmin();

    // Get user's Stripe account ID
    const { data: user } = await supabase
      .from('users')
      .select('stripe_account_id')
      .eq('auth0_id', session.user.sub)
      .single();

    if (!user?.stripe_account_id) {
      return NextResponse.redirect(new URL('/dashboard/payments?error=no_account', baseUrl));
    }

    if (status === 'refresh') {
      // User left onboarding early or link expired — generate a new link
      const accountLink = await stripe.accountLinks.create({
        account: user.stripe_account_id,
        refresh_url: `${baseUrl}/api/stripe/connect-callback?status=refresh`,
        return_url: `${baseUrl}/api/stripe/connect-callback?status=complete`,
        type: 'account_onboarding',
      });
      return NextResponse.redirect(accountLink.url);
    }

    // status === 'complete' — Check if onboarding is actually done
    const account = await stripe.accounts.retrieve(user.stripe_account_id);

    if (account.charges_enabled && account.details_submitted) {
      // Onboarding complete — update DB with currency from Stripe account
      await supabase
        .from('users')
        .update({
          stripe_onboarding_completed: true,
          default_currency: account.default_currency || 'cad',
        })
        .eq('auth0_id', session.user.sub);

      return NextResponse.redirect(new URL('/dashboard/payments?stripe=success', baseUrl));
    }

    // Stripe says not fully onboarded yet — send them back
    return NextResponse.redirect(new URL('/dashboard/payments?stripe=incomplete', baseUrl));
  } catch (err) {
    console.error('Stripe callback error:', err);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://organizer.empiriaindia.com';
    return NextResponse.redirect(new URL('/dashboard/payments?error=callback_failed', baseUrl));
  }
}
