import Image from 'next/image'

type ReportHeaderProps = {
  title?: string
  /** Optional QR image URL (e.g. data URL or uploaded PNG) */
  qrSrc?: string | null
  qrAlt?: string
}

/**
 * Cover-style header: logo left, title center, optional QR right (matches PDF page 1).
 */
export function ReportHeader({
  title = 'Maintenance Inspection Report',
  qrSrc,
  qrAlt = 'Report QR code',
}: ReportHeaderProps) {
  return (
    <div>
      <header className="relative flex min-h-[5.5rem] items-start justify-between gap-4 pb-0">
        <div className="flex shrink-0 items-center">
          <Image src="/Logo_black.png" alt="NBE Australia" width={120} height={40} className="h-10 w-auto object-contain" priority />
        </div>
        <h1 className="absolute left-1/2 top-0 max-w-[min(100%,20rem)] -translate-x-1/2 text-center text-lg font-bold tracking-tight text-slate-900 md:text-xl">
          {title}
        </h1>
        <div className="flex min-w-[5rem] flex-col items-end gap-1 text-right">
          {qrSrc ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / dynamic QR */}
              <img src={qrSrc} alt={qrAlt} className="h-20 w-20 rounded-lg border border-slate-200 bg-white object-contain p-1 shadow-sm" />
              <p className="max-w-[8rem] text-[10px] font-medium leading-tight text-slate-500">Scan to view digital report</p>
            </>
          ) : (
            <div className="h-20 w-20 rounded-lg border border-dashed border-slate-200 bg-slate-50" aria-hidden />
          )}
        </div>
      </header>
      <div className="mt-4 border-t border-gray-300 mb-6" aria-hidden />
    </div>
  )
}
