'use client'

import { useRouter } from 'next/navigation'

const DISTRIBUTION_DATA = [
  { name: 'HVAC', percentage: 42 },
  { name: 'Electrical', percentage: 28, opacity: 0.7 },
  { name: 'Plumbing', percentage: 18, opacity: 0.5 },
  { name: 'General', percentage: 12, opacity: 0.3 }
]

export function MaintenanceDistribution() {
  const router = useRouter()

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">Maintenance Distribution</h2>
        <p className="text-xs text-slate-500 mt-1">Workload by category (current month)</p>
      </div>

      <div className="flex-1 flex flex-col justify-end space-y-5">
        {DISTRIBUTION_DATA.map((item, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700">{item.name}</span>
              <span className="text-slate-900">{item.percentage}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{
                  width: `${item.percentage}%`,
                  opacity: item.opacity || 1
                }}
                role="progressbar"
                aria-valuenow={item.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100">
        <button
          onClick={() => router.push('/reports')}
          className="flex items-center gap-2 text-primary font-bold text-sm hover:underline transition-colors group"
        >
          <span className="material-symbols-outlined text-sm group-hover:translate-y-0.5 transition-transform">
            download
          </span>
          <span>Export Chart Data</span>
        </button>
      </div>
    </article>
  )
}
