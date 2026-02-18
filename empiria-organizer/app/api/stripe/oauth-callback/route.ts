import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getSupabaseAdmin } from '@/lib/supabase';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://organizer.empiriaindia.com';

  try {
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const error = req.nextUrl.searchParams.get('error');

    // User denied access or Stripe returned an error
    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/payments?error=oauth_denied&reason=${error}`, baseUrl)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/payments?error=missing_params', baseUrl)
      );
    }

    // Validate state matches the logged-in user
    if (state !== session.user.sub) {
      return NextResponse.redirect(
        new URL('/dashboard/payments?error=state_mismatch', baseUrl)
      );
    }

    // Exchange authorization code for the connected account ID
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const connectedAccountId = response.stripe_user_id;
    if (!connectedAccountId) {
      return NextResponse.redirect(
        new URL('/dashboard/payments?error=no_account_id', baseUrl)
      );
    }

    // Fetch the account to get default currency
    const account = await stripe.accounts.retrieve(connectedAccountId);

    // Save to Supabase — Standard accounts are already fully onboarded
    const supabase = getSupabaseAdmin();
    await supabase
      .from('users')
      .update({
        stripe_account_id: connectedAccountId,
        stripe_account_type: 'standard',
        stripe_onboarding_completed: true,
        default_currency: account.default_currency || 'cad',
      })
      .eq('auth0_id', session.user.sub);

    return NextResponse.redirect(
      new URL('/dashboard/payments?stripe=success', baseUrl)
    );
  } catch (err) {
    console.error('Stripe OAuth callback error:', err);
    return NextResponse.redirect(
      new URL('/dashboard/payments?error=callback_failed', baseUrl)
    );
  }
}
