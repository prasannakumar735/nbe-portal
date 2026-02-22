'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Plus, X, Download, AlertCircle } from 'lucide-react'

interface Reimbursement {
  id: string
  user_id: string
  title: string
  category: string
  description?: string
  amount: number
  expense_date: string
  status: 'pending' | 'approved' | 'rejected'
  receipt_url?: string
  created_at: string
}

const CATEGORY_COLORS: Record<string, string> = {
  travel: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  meal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  supplies: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  approved: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-500'
  },
  pending: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500'
  },
  rejected: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500'
  }
}

export default function ReimbursementPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>('')
  const [formData, setFormData] = useState({
    title: '',
    category: 'travel',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0]
  })
  const [error, setError] = useState('')

  // Check authentication and fetch reimbursements
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) {
          router.push('/')
        } else {
          setUser(data.user)
          await fetchReimbursements(data.user.id)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()
  }, [router])

  // Fetch reimbursements from Supabase
  const fetchReimbursements = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('reimbursements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setReimbursements((data as Reimbursement[]) || [])
    } catch (error) {
      console.error('Failed to fetch reimbursements:', error)
      setError('Failed to load reimbursements')
    }
  }

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }

      const validTypes = ['application/pdf', 'image/png', 'image/jpeg']
      if (!validTypes.includes(file.type)) {
        setError('Only PDF, PNG, and JPG files are allowed')
        return
      }

      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setFilePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError('')
    }
  }

  // Upload file to Supabase Storage
  const uploadReceipt = async (file: File): Promise<string | null> => {
    try {
      setUploadingFile(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file)

      if (uploadError) {
        console.error('Upload error details:', uploadError)
        throw new Error(uploadError.message || 'Failed to upload receipt')
      }

      // Get public URL
      const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
      
      if (!data?.publicUrl) {
        throw new Error('Failed to get public URL for receipt')
      }
      
      return data.publicUrl
    } catch (error: any) {
      console.error('Failed to upload receipt:', error?.message || error)
      throw new Error(error?.message || 'Failed to upload receipt')
    } finally {
      setUploadingFile(false)
    }
  }

  // Submit new reimbursement
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title || !formData.category || !formData.amount || !formData.expense_date) {
      setError('Please fill in all required fields')
      return
    }

    if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setIsSubmitting(true)

    try {
      let receiptUrl = null

      // Upload receipt if provided
      if (selectedFile) {
        try {
          receiptUrl = await uploadReceipt(selectedFile)
        } catch (uploadError: any) {
          setError(uploadError?.message || 'Failed to upload receipt. Please ensure the receipts bucket exists.')
          setIsSubmitting(false)
          return
        }
      }

      // Insert reimbursement
      const { data, error: insertError } = await supabase
        .from('reimbursements')
        .insert([
          {
            user_id: user.id,
            title: formData.title,
            category: formData.category,
            description: formData.description,
            amount: parseFloat(formData.amount),
            expense_date: formData.expense_date,
            status: 'pending',
            receipt_url: receiptUrl
          }
        ])
        .select()

      if (insertError) {
        console.error('Insert error details:', insertError)
        throw new Error(insertError.message || 'Failed to insert reimbursement')
      }

      // Update local state optimistically
      if (data && data.length > 0) {
        setReimbursements(prev => [data[0] as Reimbursement, ...prev])
      }

      // Reset form and close modal
      setShowModal(false)
      setFormData({
        title: '',
        category: 'travel',
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0]
      })
      setSelectedFile(null)
      setFilePreview('')
    } catch (error: any) {
      console.error('Failed to submit claim:', error)
      const errorMessage = error?.message || 'Failed to submit claim. Please try again.'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate statistics
  const stats = {
    total: reimbursements.reduce((sum, r) => sum + r.amount, 0),
    pending: reimbursements.filter(r => r.status === 'pending').length,
    approved: reimbursements.filter(r => r.status === 'approved').length
  }

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  })

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading reimbursements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold">Reimbursement Claims</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage and track your expense requests</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus size={20} />
            New Claim
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Reimbursed</p>
              <p className="text-2xl font-bold">{currencyFormatter.format(stats.total)}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-amber-500">pending_actions</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pending Claims</p>
              <p className="text-2xl font-bold">{stats.pending} Requests</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined text-green-500">check_circle</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Recently Approved</p>
              <p className="text-2xl font-bold">{stats.approved} Requests</p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4 font-semibold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Claim ID
                  </th>
                  <th className="px-6 py-4 font-semibold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 font-semibold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 font-semibold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 font-semibold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 font-semibold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-6 py-4 font-semibold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reimbursements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <p className="text-sm font-medium">No reimbursement claims yet</p>
                      <p className="text-xs mt-1">Create one to get started</p>
                    </td>
                  </tr>
                ) : (
                  reimbursements.map(claim => (
                    <tr key={claim.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-primary">#{claim.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {dateFormatter.format(new Date(claim.expense_date))}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[claim.category]}`}>
                          {claim.category.charAt(0).toUpperCase() + claim.category.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{claim.title}</td>
                      <td className="px-6 py-4 text-sm font-bold">{currencyFormatter.format(claim.amount)}</td>
                      <td className="px-6 py-4">
                        {claim.receipt_url ? (
                          <a
                            href={claim.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:opacity-75 transition-opacity"
                          >
                            <Download size={20} />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            STATUS_COLORS[claim.status].bg
                          } ${STATUS_COLORS[claim.status].text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[claim.status].dot}`}></span>
                          {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {reimbursements.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/50">
              <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                Showing 1 to {reimbursements.length} of {reimbursements.length} entries
              </span>
            </div>
          )}
        </div>

      {/* New Claim Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50">
          <aside className="absolute top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">New Reimbursement Claim</h3>
                <p className="text-xs text-slate-500">Fill out the details for your expense</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-2">Claim Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Flight to Berlin"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                />
              </div>

              {/* Date & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Expense Date *</label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-8 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors"
                >
                  <option value="travel">Travel</option>
                  <option value="meal">Meal</option>
                  <option value="supplies">Office Supplies</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide more context about this expense..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors resize-none"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold mb-2">Upload Receipt</label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg"
                  id="receipt-input"
                  className="hidden"
                />
                <label
                  htmlFor="receipt-input"
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  {filePreview ? (
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 mb-3 group-hover:scale-110 transition-transform mx-auto">
                        <Check size={24} className="text-green-600" />
                      </div>
                      <p className="text-sm font-medium">{selectedFile?.name}</p>
                      <p className="text-xs text-slate-500 mt-1">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform mx-auto">
                        <span className="material-symbols-outlined">cloud_upload</span>
                      </div>
                      <p className="text-sm font-medium">Drag and drop file here</p>
                      <p className="text-xs text-slate-500 mt-1">PDF, PNG, or JPG up to 10MB</p>
                      <button className="mt-4 text-sm font-semibold text-primary underline" type="button">
                        Browse Files
                      </button>
                    </div>
                  )}
                </label>
              </div>
            </form>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                type="button"
                className="flex-1 border border-slate-200 dark:border-slate-700 font-semibold py-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || uploadingFile}
                className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting || uploadingFile ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

// Missing import - need to add
function Check({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )
}
