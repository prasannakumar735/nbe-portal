// Example Next.js API Routes for Timecard Module
// Place in app/api/timecard/ directory

import { NextRequest, NextResponse } from 'next/server'
import { TimeEntryService, AuthService } from '@/lib/services/timecard.service'

// GET /api/timecard/entries - Get time entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employee_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!employeeId) {
      return NextResponse.json(
        { error: 'employee_id is required' },
        { status: 400 }
      )
    }

    const entries = await TimeEntryService.getByEmployee(
      employeeId,
      startDate || undefined,
      endDate || undefined
    )

    return NextResponse.json({ success: true, data: entries })
  } catch (error: any) {
    console.error('GET /api/timecard/entries error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch entries' },
      { status: 500 }
    )
  }
}

// POST /api/timecard/entries - Create time entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entry, userId } = body

    if (!entry || !userId) {
      return NextResponse.json(
        { error: 'entry and userId are required' },
        { status: 400 }
      )
    }

    // Check permissions
    const permissions = await AuthService.getPermissions(userId)
    if (!permissions.canCreateEntry) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Validate hours increment
    if (!TimeEntryService.validateHoursIncrement(entry.hours)) {
      return NextResponse.json(
        { error: 'Hours must be in 0.25 increments' },
        { status: 400 }
      )
    }

    // Validate daily hours
    const validation = await TimeEntryService.validateHours(
      userId,
      entry.entry_date,
      entry.hours
    )

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      )
    }

    const newEntry = await TimeEntryService.create(entry, userId)

    return NextResponse.json(
      { success: true, data: newEntry },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('POST /api/timecard/entries error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create entry' },
      { status: 500 }
    )
  }
}

// PUT /api/timecard/entries/[id] - Update time entry
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { updates, userId } = body

    if (!updates || !userId) {
      return NextResponse.json(
        { error: 'updates and userId are required' },
        { status: 400 }
      )
    }

    // Check permissions
    const permissions = await AuthService.getPermissions(userId)
    if (!permissions.canEditEntry) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Validate hours if provided
    if (updates.hours) {
      if (!TimeEntryService.validateHoursIncrement(updates.hours)) {
        return NextResponse.json(
          { error: 'Hours must be in 0.25 increments' },
          { status: 400 }
        )
      }

      const validation = await TimeEntryService.validateHours(
        userId,
        updates.entry_date || '',
        updates.hours,
        params.id
      )

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.message },
          { status: 400 }
        )
      }
    }

    const updatedEntry = await TimeEntryService.update(params.id, updates, userId)

    return NextResponse.json({ success: true, data: updatedEntry })
  } catch (error: any) {
    console.error('PUT /api/timecard/entries/[id] error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update entry' },
      { status: 500 }
    )
  }
}

// DELETE /api/timecard/entries/[id] - Delete time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    // Check permissions
    const permissions = await AuthService.getPermissions(userId)
    if (!permissions.canDeleteEntry) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    await TimeEntryService.delete(params.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/timecard/entries/[id] error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete entry' },
      { status: 500 }
    )
  }
}
