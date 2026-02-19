// Weekly Submission API Routes
// Place in app/api/timecard/submissions/ directory

import { NextRequest, NextResponse } from 'next/server'
import { WeeklySubmissionService, AuthService } from '@/lib/services/timecard.service'

// POST /api/timecard/submissions/submit - Submit week for approval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { submissionId, userId } = body

    if (!submissionId || !userId) {
      return NextResponse.json(
        { error: 'submissionId and userId are required' },
        { status: 400 }
      )
    }

    // Check permissions
    const permissions = await AuthService.getPermissions(userId)
    if (!permissions.canSubmitWeek) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const submission = await WeeklySubmissionService.submit(submissionId, userId)

    return NextResponse.json({ success: true, data: submission })
  } catch (error: any) {
    console.error('POST /api/timecard/submissions/submit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit timesheet' },
      { status: 500 }
    )
  }
}

// POST /api/timecard/submissions/approve - Approve submission
export async function approveSubmission(request: NextRequest) {
  try {
    const body = await request.json()
    const { submissionId, managerId, comments } = body

    if (!submissionId || !managerId) {
      return NextResponse.json(
        { error: 'submissionId and managerId are required' },
        { status: 400 }
      )
    }

    // Check permissions
    const permissions = await AuthService.getPermissions(managerId)
    if (!permissions.canApproveSubmission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const submission = await WeeklySubmissionService.approve(
      submissionId,
      managerId,
      comments
    )

    return NextResponse.json({ success: true, data: submission })
  } catch (error: any) {
    console.error('POST /api/timecard/submissions/approve error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to approve timesheet' },
      { status: 500 }
    )
  }
}

// POST /api/timecard/submissions/reject - Reject submission
export async function rejectSubmission(request: NextRequest) {
  try {
    const body = await request.json()
    const { submissionId, managerId, comments } = body

    if (!submissionId || !managerId || !comments) {
      return NextResponse.json(
        { error: 'submissionId, managerId, and comments are required' },
        { status: 400 }
      )
    }

    // Check permissions
    const permissions = await AuthService.getPermissions(managerId)
    if (!permissions.canRejectSubmission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const submission = await WeeklySubmissionService.reject(
      submissionId,
      managerId,
      comments
    )

    return NextResponse.json({ success: true, data: submission })
  } catch (error: any) {
    console.error('POST /api/timecard/submissions/reject error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reject timesheet' },
      { status: 500 }
    )
  }
}

// POST /api/timecard/submissions/unlock - Unlock submission
export async function unlockSubmission(request: NextRequest) {
  try {
    const body = await request.json()
    const { submissionId, managerId, reason } = body

    if (!submissionId || !managerId || !reason) {
      return NextResponse.json(
        { error: 'submissionId, managerId, and reason are required' },
        { status: 400 }
      )
    }

    // Check permissions
    const permissions = await AuthService.getPermissions(managerId)
    if (!permissions.canUnlockSubmission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const submission = await WeeklySubmissionService.unlock(
      submissionId,
      managerId,
      reason
    )

    return NextResponse.json({ success: true, data: submission })
  } catch (error: any) {
    console.error('POST /api/timecard/submissions/unlock error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to unlock timesheet' },
      { status: 500 }
    )
  }
}
