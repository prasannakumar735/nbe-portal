import Image from 'next/image'
import doorDiagramDefault from '@/app/door/door_image_reports.png'
import { DOOR_DIAGRAM_LEGEND_ITEMS } from '@/lib/maintenance/doorDiagramLegend'

export { DOOR_DIAGRAM_LEGEND, DOOR_DIAGRAM_LEGEND_ITEMS } from '@/lib/maintenance/doorDiagramLegend'

type DoorDiagramProps = {
  /** Diagram image URL (defaults to maintenance report diagram asset) */
  src?: string | null
  alt?: string
}

/** Full-width door diagram slot (page 1) with numbered component legend. */
export function DoorDiagram({ src, alt = 'Door layout diagram' }: DoorDiagramProps) {
  const resolvedSrc = src ?? doorDiagramDefault.src

  const breakAvoid = {
    pageBreakInside: 'avoid' as const,
    breakInside: 'avoid' as const,
  }

  return (
    <section
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
      style={breakAvoid}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Door Diagram</h2>
      <div
        className="mt-1 flex h-[520px] min-h-0 flex-col justify-between gap-1"
        style={breakAvoid}
      >
        {/* ~75% — diagram image (matches PDF ratio) */}
        <div
          className="flex min-h-0 flex-[3] flex-col items-center justify-center overflow-hidden rounded-xl bg-slate-50"
          style={breakAvoid}
        >
          {resolvedSrc ? (
            <div className="relative h-full w-full min-h-0">
              <Image
                src={resolvedSrc}
                alt={alt}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 672px"
                priority={false}
              />
            </div>
          ) : (
            <div className="flex min-h-[4rem] w-full flex-1 items-center justify-center border border-dashed border-slate-200 bg-white px-2 text-center text-sm text-slate-400">
              Diagram appears on PDF when configured for this report type.
            </div>
          )}
        </div>

        {/* ~25% — compact legend, two columns only */}
        <div
          className="mt-1 flex min-h-0 flex-1 flex-col border-t border-slate-200/90 pt-1"
          style={breakAvoid}
        >
          <h3 className="mb-0.5 shrink-0 text-[11px] font-semibold text-slate-700">Door Legend</h3>
          <ul
            className="min-h-0 list-none grid grid-cols-2 gap-x-3 gap-y-0.5 overflow-y-auto p-0 text-[9px] leading-3 text-gray-600"
            style={{ whiteSpace: 'normal', ...breakAvoid }}
          >
            {DOOR_DIAGRAM_LEGEND_ITEMS.map((item) => (
              <li key={item} className="min-w-0 break-words [overflow-wrap:anywhere]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
