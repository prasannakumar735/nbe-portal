import type { ServiceQuoteFormValues } from './types'

type QuotePDFTemplateProps = {
  values: ServiceQuoteFormValues
  subtotal: number
  gst: number
  total: number
}

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
})

const defaultNote =
  'Should you require any further information or clarification about this quotation, please do not hesitate to contact us.'

export function QuotePDFTemplate({ values, subtotal, gst, total }: QuotePDFTemplateProps) {
  return (
    <div
      id="quote-pdf"
      style={{
        width: '210mm',
        minHeight: '297mm',
        background: 'white',
        padding: '20mm',
        fontFamily: 'Arial',
      }}
      className="text-[12px] text-slate-900"
    >
      <div className="flex items-start justify-between border-b border-slate-300 pb-4">
        <div className="flex items-start gap-3">
          <img src="/Logo_black.png" alt="NBE Australia" className="h-16 w-auto object-contain" />
          <div className="space-y-0.5 leading-5">
            <p className="text-xl font-bold">NBE Australia</p>
            <p>22A Humeside Dr</p>
            <p>Campbellfield VIC 3061</p>
            <p>Australia</p>
            <p>Email: accountsreceivable@nbeaustralia.com.au</p>
            <p>ABN: 17 007 048 008</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-widest">QUOTE</p>
          <p className="mt-2 text-sm">Quote No: {values.quoteNumber}</p>
          <p className="text-sm">Service Date: {values.serviceDate}</p>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-300 p-3">
        <p className="mb-2 text-sm font-semibold">Customer Details</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="font-medium">Customer Name:</span> {values.customerCompany || '-'}
          </p>
          <p>
            <span className="font-medium">Contact Person:</span> {values.contactPerson || '-'}
          </p>
          <p>
            <span className="font-medium">Phone:</span> {values.phone || '-'}
          </p>
          <p>
            <span className="font-medium">Email:</span> {values.customerEmail || '-'}
          </p>
          <p className="col-span-2">
            <span className="font-medium">Site Address:</span> {values.siteAddress || '-'}
          </p>
        </div>
      </div>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-2 text-left">S.No</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Description</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Width</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Height</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Qty</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Unit Price</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Total</th>
          </tr>
        </thead>
        <tbody>
          {values.items.map((item, index) => {
            const rowTotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
            return (
              <tr key={`${item.description}-${index}`}>
                <td className="border border-slate-300 px-2 py-2">{index + 1}</td>
                <td className="border border-slate-300 px-2 py-2">{item.description || '-'}</td>
                <td className="border border-slate-300 px-2 py-2">{item.width || '-'}</td>
                <td className="border border-slate-300 px-2 py-2">{item.height || '-'}</td>
                <td className="border border-slate-300 px-2 py-2">{item.qty || 0}</td>
                <td className="border border-slate-300 px-2 py-2">{currency.format(Number(item.unitPrice || 0))}</td>
                <td className="border border-slate-300 px-2 py-2">{currency.format(rowTotal)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-5 ml-auto w-[72mm] space-y-2 text-sm">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1">
          <span>Subtotal</span>
          <span className="font-medium">{currency.format(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-slate-300 pb-1">
          <span>GST (10%)</span>
          <span className="font-medium">{currency.format(gst)}</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-base font-bold">
          <span>Total</span>
          <span>{currency.format(total)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-slate-300 p-3 text-sm">
        <p className="mb-1 font-semibold">Notes</p>
        <p>{values.notes || defaultNote}</p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-6 text-sm">
        <div>
          <p className="font-medium">Client Signature</p>
          <div className="mt-6 border-b border-slate-400" />
        </div>
        <div>
          <p className="font-medium">Name</p>
          <div className="mt-6 border-b border-slate-400 pb-0.5">{values.printedName || ''}</div>
        </div>
        <div>
          <p className="font-medium">Date</p>
          <div className="mt-6 border-b border-slate-400 pb-0.5">{values.signatureDate || ''}</div>
        </div>
      </div>
    </div>
  )
}
