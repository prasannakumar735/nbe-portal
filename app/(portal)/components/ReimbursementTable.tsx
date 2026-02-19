'use client'

import { useRouter } from 'next/navigation'

interface ReimbursementTableProps {
  onViewAll?: () => void
}

const TABLE_DATA = [
  { id: '#001', name: 'John Doe', category: 'Travel', date: 'Oct 12, 2023', amount: '$120.00', status: 'Pending', statusColor: 'amber' },
  { id: '#002', name: 'Jane Smith', category: 'Equipment', date: 'Oct 11, 2023', amount: '$450.00', status: 'Approved', statusColor: 'green' },
  { id: '#003', name: 'Robert Fox', category: 'Meals', date: 'Oct 10, 2023', amount: '$45.00', status: 'Rejected', statusColor: 'red' },
  { id: '#004', name: 'Alice Brown', category: 'Office Supplies', date: 'Oct 09, 2023', amount: '$85.00', status: 'Pending', statusColor: 'amber' }
]

export function ReimbursementTable({ onViewAll }: ReimbursementTableProps) {
  const router = useRouter()

  const getStatusColor = (statusColor: string) => {
    switch (statusColor) {
      case 'amber':
        return 'bg-amber-50 text-amber-600'
      case 'green':
        return 'bg-green-50 text-green-600'
      case 'red':
        return 'bg-red-50 text-red-600'
      default:
        return 'bg-slate-50 text-slate-600'
    }
  }

  return (
    <article className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Recent Reimbursement Claims</h2>
        <button
          onClick={() => {
            onViewAll?.()
            router.push('/reimbursement')
          }}
          className="text-sm font-semibold text-primary hover:underline transition-colors"
        >
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th scope="col" className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                ID
              </th>
              <th scope="col" className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Employee Name
              </th>
              <th scope="col" className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Category
              </th>
              <th scope="col" className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {TABLE_DATA.map(row => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-600 font-mono">{row.id}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.name}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{row.category}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{row.date}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.amount}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(row.statusColor)}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
