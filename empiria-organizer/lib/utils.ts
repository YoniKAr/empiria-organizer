import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const CURRENCY_CONFIG: Record<string, { locale: string }> = {
  usd: { locale: 'en-US' },
  cad: { locale: 'en-CA' },
  inr: { locale: 'en-IN' },
  gbp: { locale: 'en-GB' },
  eur: { locale: 'de-DE' },
  aud: { locale: 'en-AU' },
  nzd: { locale: 'en-NZ' },
  sgd: { locale: 'en-SG' },
  hkd: { locale: 'en-HK' },
  jpy: { locale: 'ja-JP' },
  mxn: { locale: 'es-MX' },
  brl: { locale: 'pt-BR' },
};

export function formatCurrency(amount: number, currency: string = 'cad'): string {
  const code = currency.toLowerCase();
  const config = CURRENCY_CONFIG[code] || { locale: 'en-US' };
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: code.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function isZeroDecimalCurrency(currency: string): boolean {
  return ['jpy', 'krw', 'vnd'].includes(currency.toLowerCase());
}

export function toStripeAmount(amount: number, currency: string): number {
  if (isZeroDecimalCurrency(currency)) return Math.round(amount);
  return Math.round(amount * 100);
}

export function getCurrencySymbol(currency: string = 'cad'): string {
  const code = currency.toLowerCase();
  const config = CURRENCY_CONFIG[code] || { locale: 'en-US' };
  const parts = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: code.toUpperCase(),
  }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value || '$';
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
