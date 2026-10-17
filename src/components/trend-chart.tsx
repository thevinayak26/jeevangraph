'use client';

import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getKidneySeries, type HealthRecord } from '@/lib/domain';

export function TrendChart({
  records,
  metric,
  onSelect,
}: {
  records: HealthRecord[];
  metric: 'creatinine' | 'egfr';
  onSelect: (id: string) => void;
}) {
  const data = getKidneySeries(records);
  const gradient = useId().replaceAll(':', '');
  const dateLabel = (value: number) =>
    new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(value),
    );
  return (
    <div
      className="trend-chart"
      role="img"
      aria-label={`${metric === 'creatinine' ? 'Creatinine' : 'Reported eGFR'} across four fictional source reports. Exact values are in the table below.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 22, bottom: 0, left: -23 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0e9d92" stopOpacity={0.19} />
              <stop offset="100%" stopColor="#0e9d92" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 5" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={data.map((p) => p.timestamp)}
            tickFormatter={dateLabel}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            dy={10}
          />
          <YAxis
            domain={metric === 'creatinine' ? [0.6, 1.8] : [40, 120]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted)' }}
            ticks={metric === 'creatinine' ? [0.6, 0.9, 1.2, 1.5, 1.8] : [40, 60, 80, 100, 120]}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={(value) => dateLabel(Number(value))}
            formatter={(value) => [
              `${value} ${metric === 'creatinine' ? 'mg/dL' : 'mL/min/1.73m²'}`,
              metric === 'creatinine' ? 'Creatinine' : 'Reported eGFR',
            ]}
          />
          <Area
            type="linear"
            dataKey={metric}
            stroke="#0c998e"
            strokeWidth={3}
            fill={`url(#${gradient})`}
            animationDuration={0}
            dot={{ r: 5, fill: 'var(--surface)', stroke: '#0c998e', strokeWidth: 3 }}
            activeDot={{
              r: 7,
              strokeWidth: 3,
              onClick: (_event: unknown, value: unknown) => {
                const point = value as { payload?: { recordId?: string } };
                if (point.payload?.recordId) onSelect(point.payload.recordId);
              },
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
