import Image from 'next/image'
import type { SignOffDisplayMetrics, SignOffFindingGroup } from '@/lib/maintenance/reportMetrics'

export type ApprovalSignOffSummaryProps = {
  metrics: SignOffDisplayMetrics
  findingGroups: SignOffFindingGroup[]
  /** Shown under technician signature area */
  technicianName?: string
  reportDateLabel?: string
  /**
   * When false, only header + summary + findings (no signature/date blocks).
   * Default true for full Approval & Sign-off layout.
   */
  showSignatureSection?: boolean
}

function formatGroupSuffix(g: SignOffFindingGroup): string {
  const parts: string[] = []
  if (g.caution > 0) {
    parts.push(`${g.caution} ${g.caution === 1 ? 'caution' : 'cautions'}`)
  }
  if (g.fault > 0) {
    parts.push(`${g.fault} ${g.fault === 1 ? 'fault' : 'faults'}`)
  }
  return parts.join(', ')
}

/**
 * Client-facing Approval & Sign-off layout (mirrors merged PDF last page).
 * Health score: good / (totalChecks − N/A); N/A is not shown in Summary.
 */
export function ApprovalSignOffSummary({
  metrics,
  findingGroups,
  technicianName = '—',
  reportDateLabel = '—',
  showSignatureSection = true,
}: ApprovalSignOffSummaryProps) {
  const validChecks = metrics.totalChecks - metrics.na
  const healthScore =
    validChecks > 0 ? Math.round((metrics.good / validChecks) * 100) : 0

  const listed = findingGroups.filter(g => g.caution > 0 || g.fault > 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center gap-6">
        <Image
          src="/Logo_black.png"
          alt="NBE Australia"
          width={120}
          height={40}
          className="h-12 w-auto object-contain"
          priority
        />
        <h1 className="text-2xl font-semibold text-blue-900">Approval &amp; Sign-off</h1>
      </header>

      <h2 className="mb-3 mt-6 text-lg font-semibold text-blue-900">Summary</h2>

      <div className="grid max-w-xs grid-cols-[auto_60px] gap-y-1 text-sm">
        <span className="text-gray-700">Total doors</span>
        <span className="text-right tabular-nums text-gray-900">{metrics.totalDoors}</span>
        <span className="text-gray-700">Total checks</span>
        <span className="text-right tabular-nums text-gray-900">{metrics.totalChecks}</span>
        <span className="text-gray-700">Good</span>
        <span className="text-right tabular-nums text-gray-900">{metrics.good}</span>
        <span className="text-gray-700">Caution</span>
        <span className="text-right tabular-nums text-gray-900">{metrics.caution}</span>
        <span className="text-gray-700">Fault</span>
        <span className="text-right tabular-nums text-gray-900">{metrics.fault}</span>
      </div>

      <p className="mt-3 font-semibold text-green-700">
        Overall Health Score: {healthScore}%
      </p>

      <h3 className="mt-5 font-semibold text-blue-900">Findings by section</h3>
      {listed.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No faults or cautions recorded.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-gray-800">
          {listed.map(g => (
            <li key={g.section}>
              - {g.section} → {formatGroupSuffix(g)}
            </li>
          ))}
        </ul>
      )}

      <hr className="my-6 border-gray-300" />

      {showSignatureSection ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-10">
            <div>
              <h4 className="font-semibold text-blue-900">Technician</h4>
              <div className="mt-2 h-24 rounded-md border border-gray-300 bg-gray-50/50" />
              <p className="mt-1 text-sm text-gray-900">{technicianName}</p>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">Manager</h4>
              <div className="mt-2 h-24 rounded-md border border-gray-300 bg-gray-50/50" />
              <p className="mt-1 text-xs text-gray-500">Authorised signatory</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-10">
            <div>
              <h4 className="font-semibold text-blue-900">Date</h4>
              <div className="mt-2 rounded-md border border-gray-300 p-2 text-sm text-gray-900">
                {reportDateLabel}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">Client acknowledgement</h4>
              <div className="mt-2 rounded-md border border-gray-300 p-2 text-sm text-gray-400">
                Name / signature / date
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
