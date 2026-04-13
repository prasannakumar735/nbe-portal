import { ClientReportChrome } from '@/components/merged-report/ClientReportChrome'

type ClientReportMessageProps = {
  title: string
  description: string
}

export function ClientReportMessage({ title, description }: ClientReportMessageProps) {
  return (
    <ClientReportChrome>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        <h1 className="text-center text-lg font-semibold text-gray-900">{title}</h1>
        <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-gray-500">{description}</p>
      </div>
    </ClientReportChrome>
  )
}
