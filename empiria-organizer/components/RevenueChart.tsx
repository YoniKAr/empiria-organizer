'use client';

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

type DataPoint = {
    date: string;       // formatted label e.g. "Feb 1"
    revenue: number;    // cumulative revenue at that date
    rawDate: string;    // ISO date string for tooltip
};

type Props = {
    data: DataPoint[];
    currency: string;
};

function formatCurrencyLocal(amount: number, currency: string) {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

// Custom tooltip shown on hover
function CustomTooltip({
    active,
    payload,
    currency,
}: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
    currency: string;
}) {
    if (!active || !payload || payload.length === 0) return null;

    const point = payload[0];
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
            <p className="font-bold text-gray-900">
                {formatCurrencyLocal(point.value, currency)}
            </p>
        </div>
    );
}

const DUMMY_DATA = [
    { date: 'Sep 1', revenue: 420, rawDate: '2024-09-01' },
    { date: 'Sep 8', revenue: 950, rawDate: '2024-09-08' },
    { date: 'Sep 15', revenue: 1800, rawDate: '2024-09-15' },
    { date: 'Oct 1', revenue: 2600, rawDate: '2024-10-01' },
    { date: 'Oct 12', revenue: 3100, rawDate: '2024-10-12' },
    { date: 'Oct 28', revenue: 4750, rawDate: '2024-10-28' },
    { date: 'Nov 5', revenue: 5200, rawDate: '2024-11-05' },
    { date: 'Nov 20', revenue: 6800, rawDate: '2024-11-20' },
    { date: 'Dec 3', revenue: 8400, rawDate: '2024-12-03' },
    { date: 'Dec 18', revenue: 9100, rawDate: '2024-12-18' },
    { date: 'Jan 6', revenue: 11200, rawDate: '2025-01-06' },
    { date: 'Jan 22', revenue: 13500, rawDate: '2025-01-22' },
    { date: 'Feb 5', revenue: 15800, rawDate: '2025-02-05' },
    { date: 'Feb 19', revenue: 18200, rawDate: '2025-02-19' },
];

export default function RevenueChart({ data, currency }: Props) {
    const isDummy = data.length === 0;
    const displayData = isDummy ? DUMMY_DATA : data;

    return (
        <>

            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F98C1F" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#F98C1F" stopOpacity={0} />
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
                        tickFormatter={(v) => formatCurrencyLocal(v, currency)}
                        width={70}
                    />
                    <Tooltip
                        content={<CustomTooltip currency={currency} />}
                        cursor={{ stroke: '#F98C1F', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#F98C1F"
                        strokeWidth={2.5}
                        fill="url(#revenueGradient)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#F98C1F', stroke: '#fff', strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </>
    );
}

