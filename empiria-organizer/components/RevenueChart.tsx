'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    ComposedChart,
    Area,
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

function formatCurrencyLocal(amount: number, currency: string) {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/** Smart tick formatting based on magnitude (PnL trading-style) */
function formatAxisTick(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
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
    // 1Y or All -> group by month
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

    // Use real orders directly — no dummy/demo data fallback
    const sourceOrders = orders;

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

    // ── PnL-style auto-scaling Y-axis domain ────────────────────────────────
    const { yDomain, yAxisWidth } = useMemo(() => {
        if (chartData.length === 0) {
            return { yDomain: [0, 1] as [number, number], yAxisWidth: 45 };
        }
        const values = chartData.map((d) => d.revenue);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const padding = (maxVal - minVal) * 0.1 || 1;
        const domainMin = Math.max(0, minVal - padding);
        const domainMax = maxVal + padding;

        // Dynamic width based on largest formatted label
        const maxLabel = formatAxisTick(domainMax);
        const computedWidth = Math.max(45, maxLabel.length * 10);

        return {
            yDomain: [domainMin, domainMax] as [number, number],
            yAxisWidth: computedWidth,
        };
    }, [chartData]);

    // ── Period change indicator (PnL style) ─────────────────────────────────
    const { change, pctChange, isPositive } = useMemo(() => {
        if (chartData.length < 2) {
            return { change: 0, pctChange: '0.0', isPositive: true };
        }
        const firstVal = chartData[0]?.revenue ?? 0;
        const lastVal = chartData[chartData.length - 1]?.revenue ?? 0;
        const diff = lastVal - firstVal;
        const pct = firstVal > 0 ? ((diff / firstVal) * 100).toFixed(1) : '0.0';
        return { change: diff, pctChange: pct, isPositive: diff >= 0 };
    }, [chartData]);

    return (
        <div>
            {/* Period Toggle + Change Indicator + Live Clock */}
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3">
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
                    {/* Period change badge */}
                    {chartData.length >= 2 && (
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                isPositive
                                    ? 'bg-green-50 text-green-600'
                                    : 'bg-red-50 text-red-600'
                            }`}
                        >
                            <span>{isPositive ? '+' : ''}{formatCurrencyLocal(change, currency)}</span>
                            <span className="opacity-70">({isPositive ? '+' : ''}{pctChange}%)</span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {liveTimestamp}
                </div>
            </div>

            {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[220px] text-gray-400 text-sm gap-1">
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    <span>No revenue data for this period</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart
                        data={chartData.length === 1 ? [{ date: '', revenue: 0 }, ...chartData] : chartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#F98C1F" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#F98C1F" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
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
                            tickFormatter={formatAxisTick}
                            domain={yDomain}
                            width={yAxisWidth}
                        />
                        <Tooltip
                            content={<CustomTooltip currency={currency} />}
                            cursor={{ stroke: '#F98C1F', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            fill="url(#revenueGradient)"
                            stroke="none"
                        />
                        <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#F98C1F"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, fill: '#F98C1F', stroke: '#fff', strokeWidth: 2 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
