'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

export type RawOrder = {
    created_at: string;
    organizer_payout_amount: number | string;
};

type Period = '7D' | '30D' | '3M' | '1Y' | 'All';

type Props = {
    orders: RawOrder[];
    currency: string;
};

const PERIODS: { label: string; value: Period }[] = [
    { label: '7D', value: '7D' },
    { label: '30D', value: '30D' },
    { label: '3M', value: '3M' },
    { label: '1Y', value: '1Y' },
    { label: 'All', value: 'All' },
];

// ─── Supabase Integration Note ───────────────────────────────────────────────
// When real data is available, pass it from page.tsx like:
//   const { data: orders } = await supabase
//       .from('orders')
//       .select('created_at, organizer_payout_amount')
//       .eq('status', 'completed')
//       .eq('events.organizer_id', orgId);
// The `orders` prop already matches this shape. Dummy data is used automatically
// when orders.length === 0 (i.e., no real Supabase data yet).
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrencyLocal(amount: number, currency: string) {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function CustomTooltip({
    active,
    payload,
    label,
    currency,
}: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
    currency: string;
}) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
            <p className="text-gray-500 text-xs mb-1">{label}</p>
            <p className="font-bold text-gray-900">{formatCurrencyLocal(payload[0].value, currency)}</p>
        </div>
    );
}

function getPeriodStart(period: Period): Date | null {
    const now = new Date();
    switch (period) {
        case '7D': return new Date(now.getTime() - 7 * 86400000);
        case '30D': return new Date(now.getTime() - 30 * 86400000);
        case '3M': return new Date(now.getTime() - 90 * 86400000);
        case '1Y': return new Date(now.getTime() - 365 * 86400000);
        case 'All': return null;
    }
}

function getGroupKey(date: Date, period: Period): string {
    if (period === '7D' || period === '30D') {
        return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    }
    if (period === '3M') {
        // Group by week
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    }
    // 1Y or All → group by month
    return date.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' });
}

export default function RevenueChart({ orders, currency }: Props) {
    const [period, setPeriod] = useState<Period>('All');

    // ── Live clock ──────────────────────────────────────────────────────────
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const liveTimestamp = now.toLocaleString('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
    // ────────────────────────────────────────────────────────────────────────

    // Dummy data generated relative to current time — replaced automatically
    // when real Supabase orders are passed via the `orders` prop.
    const isDummy = orders.length === 0;
    const sourceOrders = useMemo<RawOrder[]>(() => {
        if (!isDummy) return orders;
        return [
            ...Array.from({ length: 14 }, (_, i) => ({
                created_at: new Date(now.getTime() - (13 - i) * 24 * 60 * 60 * 1000).toISOString(),
                organizer_payout_amount: 200 + Math.random() * 600,
            })),
            ...Array.from({ length: 30 }, (_, i) => ({
                created_at: new Date(now.getTime() - (60 - i) * 24 * 60 * 60 * 1000).toISOString(),
                organizer_payout_amount: 300 + Math.random() * 800,
            })),
            ...Array.from({ length: 20 }, (_, i) => ({
                created_at: new Date(now.getTime() - (150 - i * 3) * 24 * 60 * 60 * 1000).toISOString(),
                organizer_payout_amount: 400 + Math.random() * 1000,
            })),
            ...Array.from({ length: 14 }, (_, i) => ({
                created_at: new Date(now.getTime() - (365 - i * 20) * 24 * 60 * 60 * 1000).toISOString(),
                organizer_payout_amount: 500 + Math.random() * 1200,
            })),
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDummy, orders]); // Intentionally NOT depending on `now` — dummy data is fixed at mount

    const chartData = useMemo(() => {
        const start = getPeriodStart(period);

        // Filter by period
        const filtered = sourceOrders.filter((o) => {
            if (!start) return true;
            return new Date(o.created_at) >= start;
        });

        // Sort ascending
        const sorted = [...filtered].sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
        );

        // Group by period bucket (non-cumulative sum per bucket)
        const grouped: Record<string, number> = {};
        for (const o of sorted) {
            const key = getGroupKey(new Date(o.created_at), period);
            grouped[key] = (grouped[key] || 0) + Number(o.organizer_payout_amount);
        }

        // Build cumulative data
        let cumulative = 0;
        return Object.entries(grouped).map(([date, amount]) => {
            cumulative += amount;
            return { date, revenue: Math.round(cumulative * 100) / 100 };
        });
    }, [sourceOrders, period]);

    return (
        <div>
            {/* Period Toggle + Live Clock */}
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex gap-1">
                    {PERIODS.map((p) => (
                        <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${period === p.value
                                ? 'bg-[#F98C1F] text-white shadow-sm'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {liveTimestamp}
                    {isDummy && <span className="ml-1 text-[10px] text-orange-400 font-sans font-medium">(demo)</span>}
                </div>
            </div>

            {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">
                    No data for this period
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => formatCurrencyLocal(v, currency)}
                            width={70}
                        />
                        <Tooltip
                            content={<CustomTooltip currency={currency} />}
                            cursor={{ stroke: '#F98C1F', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#F98C1F"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, fill: '#F98C1F', stroke: '#fff', strokeWidth: 2 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
