// Unit Tests for Timecard Module
// Run with: npm test or jest

import { TimeEntryService, WorkTypeService, WeeklySubmissionService } from '@/lib/services/timecard.service'

describe('TimeEntryService', () => {
  describe('validateHoursIncrement', () => {
    it('should accept valid 0.25 increments', () => {
      expect(TimeEntryService.validateHoursIncrement(0.25)).toBe(true)
      expect(TimeEntryService.validateHoursIncrement(0.5)).toBe(true)
      expect(TimeEntryService.validateHoursIncrement(0.75)).toBe(true)
      expect(TimeEntryService.validateHoursIncrement(1.0)).toBe(true)
      expect(TimeEntryService.validateHoursIncrement(8.25)).toBe(true)
      expect(TimeEntryService.validateHoursIncrement(15.75)).toBe(true)
    })

    it('should reject invalid increments', () => {
      expect(TimeEntryService.validateHoursIncrement(1.1)).toBe(false)
      expect(TimeEntryService.validateHoursIncrement(1.33)).toBe(false)
      expect(TimeEntryService.validateHoursIncrement(8.3)).toBe(false)
      expect(TimeEntryService.validateHoursIncrement(0.1)).toBe(false)
    })

    it('should accept boundary values', () => {
      expect(TimeEntryService.validateHoursIncrement(0.25)).toBe(true)
      expect(TimeEntryService.validateHoursIncrement(16)).toBe(true)
    })
  })

  describe('validateHours', () => {
    // Mock data
    const mockUserId = 'user-123'
    const mockDate = '2026-02-19'

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks()
    })

    it('should validate hours within daily limit', async () => {
      // Mock existing entries totaling 8 hours
      const mockEntries = [
        { hours: 4 },
        { hours: 4 }
      ]

      // Add 4 more hours (total 12, under 16)
      const result = await TimeEntryService.validateHours(mockUserId, mockDate, 4)
      expect(result.valid).toBe(true)
    })

    it('should reject hours exceeding 16 hour daily limit', async () => {
      // Mock existing entries totaling 10 hours
      const mockEntries = [
        { hours: 6 },
        { hours: 4 }
      ]

      // Try to add 7 more hours (total 17, exceeds 16)
      const result = await TimeEntryService.validateHours(mockUserId, mockDate, 7)
      expect(result.valid).toBe(false)
      expect(result.message).toContain('exceed 16 hours')
    })

    it('should allow exactly 16 hours', async () => {
      // Mock existing entries totaling 8 hours
      const mockEntries = [{ hours: 8 }]

      // Add 8 more (total 16)
      const result = await TimeEntryService.validateHours(mockUserId, mockDate, 8)
      expect(result.valid).toBe(true)
    })
  })
})

describe('WorkTypeService', () => {
  describe('getGroupedByLevel1', () => {
    it('should group work types correctly', async () => {
      const grouped = await WorkTypeService.getGroupedByLevel1()

      // Check structure
      expect(Array.isArray(grouped)).toBe(true)
      expect(grouped.length).toBeGreaterThan(0)

      // Check FAB exists with Frame, Curtain, etc.
      const fab = grouped.find(g => g.id === 'FAB')
      expect(fab).toBeDefined()
      expect(fab?.description).toBe('Fabrication')
      expect(fab?.level2Options).toContainEqual(
        expect.objectContaining({
          id: 'FRM',
          description: 'Frame',
          billable: true
        })
      )
    })

    it('should correctly set billable flags', async () => {
      const grouped = await WorkTypeService.getGroupedByLevel1()

      // FAB work types should be billable
      const fab = grouped.find(g => g.id === 'FAB')
      fab?.level2Options.forEach(l2 => {
        expect(l2.billable).toBe(true)
      })

      // ADM work types should be non-billable
      const adm = grouped.find(g => g.id === 'ADM')
      adm?.level2Options.forEach(l2 => {
        expect(l2.billable).toBe(false)
      })
    })

    it('should mark leave types correctly', async () => {
      const grouped = await WorkTypeService.getGroupedByLevel1()
      const lvh = grouped.find(g => g.id === 'LVH')

      lvh?.level2Options.forEach(l2 => {
        expect(l2.isLeaveType).toBe(true)
        expect(l2.billable).toBe(false)
      })
    })
  })

  describe('getBillableFlag', () => {
    it('should return correct billable flag for FAB-FRM', async () => {
      const billable = await WorkTypeService.getBillableFlag('FAB', 'FRM')
      expect(billable).toBe(true)
    })

    it('should return correct billable flag for ADM-GEN', async () => {
      const billable = await WorkTypeService.getBillableFlag('ADM', 'GEN')
      expect(billable).toBe(false)
    })

    it('should return correct billable flag for OPS-SRW', async () => {
      const billable = await WorkTypeService.getBillableFlag('OPS', 'SRW')
      expect(billable).toBe(false) // Warranty service is non-billable
    })
  })
})

describe('WeeklySubmissionService', () => {
  const mockUserId = 'user-123'
  const mockWeekStart = '2026-02-17' // Monday

  describe('create', () => {
    it('should create submission with correct week dates', async () => {
      const submission = await WeeklySubmissionService.create(mockUserId, mockWeekStart)

      expect(submission.week_start_date).toBe(mockWeekStart)
      expect(submission.week_end_date).toBe('2026-02-23') // Sunday
      expect(submission.status).toBe('draft')
    })

    it('should calculate totals from time entries', async () => {
      // Mock time entries for the week
      // Entry 1: 8h billable
      // Entry 2: 4h billable
      // Entry 3: 2h non-billable

      const submission = await WeeklySubmissionService.create(mockUserId, mockWeekStart)

      expect(submission.total_hours).toBe(14)
      expect(submission.billable_hours).toBe(12)
    })
  })

  describe('submit', () => {
    it('should update status to submitted', async () => {
      const submission = await WeeklySubmissionService.create(mockUserId, mockWeekStart)
      const submitted = await WeeklySubmissionService.submit(submission.id, mockUserId)

      expect(submitted.status).toBe('submitted')
      expect(submitted.submitted_at).toBeDefined()
    })

    it('should link time entries to submission', async () => {
      const submission = await WeeklySubmissionService.create(mockUserId, mockWeekStart)
      await WeeklySubmissionService.submit(submission.id, mockUserId)

      // Check that entries are linked
      const entries = await TimeEntryService.getByWeek(mockUserId, mockWeekStart)
      entries.forEach(entry => {
        expect(entry.weekly_submission_id).toBe(submission.id)
      })
    })
  })

  describe('approve', () => {
    it('should update status to approved', async () => {
      const mockManagerId = 'manager-456'
      const submission = await WeeklySubmissionService.create(mockUserId, mockWeekStart)
      await WeeklySubmissionService.submit(submission.id, mockUserId)

      const approved = await WeeklySubmissionService.approve(
        submission.id,
        mockManagerId,
        'Approved - all hours verified'
      )

      expect(approved.status).toBe('approved')
      expect(approved.reviewed_by).toBe(mockManagerId)
      expect(approved.reviewed_at).toBeDefined()
      expect(approved.manager_comments).toBe('Approved - all hours verified')
    })
  })

  describe('reject', () => {
    it('should update status to rejected and unlink entries', async () => {
      const mockManagerId = 'manager-456'
      const submission = await WeeklySubmissionService.create(mockUserId, mockWeekStart)
      await WeeklySubmissionService.submit(submission.id, mockUserId)

      const rejected = await WeeklySubmissionService.reject(
        submission.id,
        mockManagerId,
        'Please clarify hours on Tuesday'
      )

      expect(rejected.status).toBe('rejected')
      expect(rejected.manager_comments).toBe('Please clarify hours on Tuesday')

      // Entries should be unlinked
      const entries = await TimeEntryService.getByWeek(mockUserId, mockWeekStart)
      entries.forEach(entry => {
        expect(entry.weekly_submission_id).toBeNull()
      })
    })
  })

  describe('unlock', () => {
    it('should change status to draft and unlink entries', async () => {
      const mockManagerId = 'manager-456'
      const submission = await WeeklySubmissionService.create(mockUserId, mockWeekStart)
      await WeeklySubmissionService.submit(submission.id, mockUserId)
      await WeeklySubmissionService.approve(submission.id, mockManagerId)

      const unlocked = await WeeklySubmissionService.unlock(
        submission.id,
        mockManagerId,
        'Unlock for employee to add missing hours'
      )

      expect(unlocked.status).toBe('draft')
    })
  })
})

describe('Integration Tests', () => {
  describe('Complete Time Entry Flow', () => {
    it('should create entry, submit week, and approve', async () => {
      const userId = 'test-user-123'
      const managerId = 'test-manager-456'
      const weekStart = '2026-02-17'

      // 1. Create time entry
      const entry = await TimeEntryService.create({
        entry_date: '2026-02-19',
        work_type_level1_id: 'FAB',
        work_type_level2_id: 'FRM',
        project_id: 'project-123',
        hours: 8.5,
        notes: 'Frame fabrication'
      }, userId)

      expect(entry.billable).toBe(true) // Auto-set from work type

      // 2. Create and submit weekly submission
      const submission = await WeeklySubmissionService.create(userId, weekStart)
      expect(submission.total_hours).toBe(8.5)

      await WeeklySubmissionService.submit(submission.id, userId)

      // 3. Entry should now be locked
      await expect(
        TimeEntryService.update(entry.id, { hours: 9 }, userId)
      ).rejects.toThrow()

      // 4. Manager approves
      const approved = await WeeklySubmissionService.approve(
        submission.id,
        managerId,
        'All good'
      )

      expect(approved.status).toBe('approved')
    })
  })

  describe('Work Type Cascade', () => {
    it('should correctly cascade from Level1 to Level2 to Billable', async () => {
      const userId = 'test-user-123'

      // FAB → FRM → Billable
      const entry1 = await TimeEntryService.create({
        entry_date: '2026-02-19',
        work_type_level1_id: 'FAB',
        work_type_level2_id: 'FRM',
        project_id: 'project-123',
        hours: 8,
        notes: ''
      }, userId)
      expect(entry1.billable).toBe(true)

      // ADM → GEN → Non-Billable
      const entry2 = await TimeEntryService.create({
        entry_date: '2026-02-19',
        work_type_level1_id: 'ADM',
        work_type_level2_id: 'GEN',
        project_id: 'project-123',
        hours: 2,
        notes: ''
      }, userId)
      expect(entry2.billable).toBe(false)

      // OPS → SRW → Non-Billable (warranty)
      const entry3 = await TimeEntryService.create({
        entry_date: '2026-02-19',
        work_type_level1_id: 'OPS',
        work_type_level2_id: 'SRW',
        project_id: 'project-123',
        hours: 3,
        notes: ''
      }, userId)
      expect(entry3.billable).toBe(false)
    })
  })
})

// Export for Jest
export {}
