'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

export interface WeeklyBarDatum {
  day: string
  hours: number
}

interface WeeklyBarChartProps {
  data: WeeklyBarDatum[]
}

export function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} stroke="#94a3b8" />
          <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" />
          <Tooltip
            formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(2)}h`}
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.08)'
            }}
          />
          <Legend />
          <Bar dataKey="hours" name="Hours" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
