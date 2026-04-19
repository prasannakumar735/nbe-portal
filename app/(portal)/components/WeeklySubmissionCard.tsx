'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Lock, Unlock, Send, AlertCircle, Clock, MessageSquare } from 'lucide-react'
import { WeeklySubmissionService, TimeEntryService } from '@/lib/services/timecard.service'
import type { WeeklySubmission, TimeEntryWithDetails, SubmissionStatus, UserRole } from '@/lib/types/timecard.types'

interface WeeklySubmissionCardProps {
  userId: string
  userRole: UserRole
  weekStartDate: string
  onUpdate?: () => void
}

export default function WeeklySubmissionCard({ 
  userId, 
  userRole,
  weekStartDate, 
  onUpdate 
}: WeeklySubmissionCardProps) {
  const [submission, setSubmission] = useState<WeeklySubmission | null>(null)
  const [entries, setEntries] = useState<TimeEntryWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewComments, setReviewComments] = useState('')
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'unlock'>('approve')

  useEffect(() => {
    loadSubmissionData()
  }, [weekStartDate, userId])

  const loadSubmissionData = async () => {
    setIsLoading(true)
    try {
      const [submissionData, entriesData] = await Promise.all([
        WeeklySubmissionService.getByWeek(userId, weekStartDate),
        TimeEntryService.getByWeek(userId, weekStartDate)
      ])

      setSubmission(submissionData)
      setEntries(entriesData)
    } catch (error) {
      console.error('Failed to load submission:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!confirm('Submit this week for approval? You will not be able to edit entries until reviewed.')) {
      return
    }

    setIsProcessing(true)
    try {
      let submissionId = submission?.id

      // Create submission if doesn't exist
      if (!submissionId) {
        const newSubmission = await WeeklySubmissionService.create(userId, weekStartDate)
        submissionId = newSubmission.id
      }

      // Submit it
      await WeeklySubmissionService.submit(submissionId, userId)

      try {
        await fetch('/api/notifications/timesheet-submitted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ submission_id: submissionId }),
        })
      } catch (notifyErr) {
        console.warn('[WeeklySubmissionCard] Timesheet notification request failed', notifyErr)
      }

      await loadSubmissionData()
      if (onUpdate) onUpdate()
    } catch (error: any) {
      console.error('Failed to submit:', error)
      alert(error.message || 'Failed to submit timesheet')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReview = async () => {
    if (!submission) return

    setIsProcessing(true)
    try {
      switch (reviewAction) {
        case 'approve':
          await WeeklySubmissionService.approve(submission.id, userId, reviewComments)
          break
        case 'reject':
          if (!reviewComments.trim()) {
            alert('Please provide a reason for rejection')
            setIsProcessing(false)
            return
          }
          await WeeklySubmissionService.reject(submission.id, userId, reviewComments)
          break
        case 'unlock':
          if (!reviewComments.trim()) {
            alert('Please provide a reason for unlocking')
            setIsProcessing(false)
            return
          }
          await WeeklySubmissionService.unlock(submission.id, userId, reviewComments)
          break
      }

      setShowReviewModal(false)
      setReviewComments('')
      await loadSubmissionData()
      if (onUpdate) onUpdate()
    } catch (error: any) {
      console.error('Failed to review:', error)
      alert(error.message || 'Failed to process review')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: SubmissionStatus) => {
    const badges = {
      draft: {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
        icon: <Clock size={14} />
      },
      submitted: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: <Send size={14} />
      },
      approved: {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <CheckCircle size={14} />
      },
      rejected: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: <XCircle size={14} />
      },
      locked: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: <Lock size={14} />
      }
    }

    const badge = badges[status]
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${badge.bg} ${badge.text} ${badge.border}`}>
        {badge.icon}
        {status.toUpperCase()}
      </span>
    )
  }

  const canSubmit = () => {
    return submission?.status === 'draft' || submission?.status === 'rejected' || !submission
  }

  const canReview = () => {
    return (userRole === 'manager' || userRole === 'admin') && submission?.status === 'submitted'
  }

  const canUnlock = () => {
    return (userRole === 'manager' || userRole === 'admin') && 
           (submission?.status === 'approved' || submission?.status === 'locked')
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  const weekEnd = new Date(weekStartDate)
  weekEnd.setDate(weekEnd.getDate() + 6)

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-3">
              Weekly Submission
              {submission && getStatusBadge(submission.status)}
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Week: {new Date(weekStartDate).toLocaleDateString()} - {weekEnd.toLocaleDateString()}
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900">
              {submission?.total_hours.toFixed(2) || '0.00'}h
            </div>
            <div className="text-xs text-slate-500">
              {submission?.billable_hours.toFixed(2) || '0.00'}h billable
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-6 space-y-4">
          {/* Entry Count */}
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-600">Total Entries</span>
            <span className="text-sm font-bold">{entries.length}</span>
          </div>

          {/* Billable Percentage */}
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-600">Billable %</span>
            <span className="text-sm font-bold text-emerald-600">
              {submission?.total_hours 
                ? ((submission.billable_hours / submission.total_hours) * 100).toFixed(1) 
                : '0.0'}%
            </span>
          </div>

          {/* Status Info */}
          {submission?.submitted_at && (
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-600">Submitted</span>
              <span className="text-sm">{new Date(submission.submitted_at).toLocaleString()}</span>
            </div>
          )}

          {submission?.reviewed_at && (
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-600">Reviewed</span>
              <span className="text-sm">{new Date(submission.reviewed_at).toLocaleString()}</span>
            </div>
          )}

          {/* Manager Comments */}
          {submission?.manager_comments && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <MessageSquare size={18} className="text-amber-600 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-1">
                    Manager Comments
                  </p>
                  <p className="text-sm text-amber-800">{submission.manager_comments}</p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {entries.length === 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-900">No Entries</p>
                <p className="text-xs text-red-700">Add time entries before submitting this week.</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {canSubmit() && entries.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-primary text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Submit for Approval
                  </>
                )}
              </button>
            )}

            {canReview() && (
              <>
                <button
                  onClick={() => {
                    setReviewAction('approve')
                    setShowReviewModal(true)
                  }}
                  className="flex-1 px-4 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  Approve
                </button>
                <button
                  onClick={() => {
                    setReviewAction('reject')
                    setShowReviewModal(true)
                  }}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={18} />
                  Reject
                </button>
              </>
            )}

            {canUnlock() && (
              <button
                onClick={() => {
                  setReviewAction('unlock')
                  setShowReviewModal(true)
                }}
                className="flex-1 px-4 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
              >
                <Unlock size={18} />
                Unlock for Editing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold">
                {reviewAction === 'approve' && 'Approve Timesheet'}
                {reviewAction === 'reject' && 'Reject Timesheet'}
                {reviewAction === 'unlock' && 'Unlock Timesheet'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Comments {reviewAction !== 'approve' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  rows={4}
                  placeholder={
                    reviewAction === 'approve' 
                      ? 'Optional: Add approval comments...'
                      : reviewAction === 'reject'
                      ? 'Required: Explain why this timesheet is being rejected...'
                      : 'Required: Explain why this timesheet is being unlocked...'
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReviewModal(false)
                    setReviewComments('')
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={isProcessing}
                  className={`flex-1 px-4 py-2.5 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    reviewAction === 'approve' 
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : reviewAction === 'reject'
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
