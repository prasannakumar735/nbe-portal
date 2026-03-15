'use client'

import type { DoorFaultInfo } from '@/hooks/useMaintenanceFaultDetection'

type FaultSummaryPanelProps = {
  doorsWithFaults: DoorFaultInfo[]
}

export function FaultSummaryPanel({ doorsWithFaults }: FaultSummaryPanelProps) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Detected Faults</h3>

      {doorsWithFaults.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No checklist faults detected.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {doorsWithFaults.map(doorFault => (
            <div key={`${doorFault.doorIndex}-${doorFault.doorLabel}`} className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-bold text-red-800">{doorFault.doorLabel}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                {doorFault.faultItems.map(item => (
                  <li key={`${doorFault.doorIndex}-${item.code}`}>{item.label}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
