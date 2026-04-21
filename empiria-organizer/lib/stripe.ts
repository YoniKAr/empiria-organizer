import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET || '', {
  apiVersion: '2026-02-25.clover',
  typescript: true,
});
