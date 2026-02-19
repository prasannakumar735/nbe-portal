# NBE Portal - Timecard Module

## Overview

Complete timecard management system with work type hierarchy, time entry tracking, weekly submissions, manager approvals, role-based permissions, and analytics dashboard.

## Features

### 1. Work Type Structure
- **Two-level hierarchy**: Level1 (FAB, OPS, BDV, ADM, RND, LVH) → Level2 (specific tasks)
- **Automatic billable flag**: Set based on work type selection
- **Leave type handling**: Separate handling for PHL, ALV, SLV, PLV
- **Exact data matching**: Matches NBE Australia Application structure

### 2. Time Entry Management
- **Fields**: Date, Work Type (L1+L2), Project/Client, Hours, Notes
- **Quarter-hour increments**: 0.25 hour validation (15-minute intervals)
- **Daily limit**: Maximum 16 hours per day with validation
- **Project requirement**: Required for non-leave work types
- **Cascading dropdowns**: Level2 options filtered by Level1 selection

### 3. Weekly Submission Flow
- **Status lifecycle**: Draft → Submitted → Approved/Rejected
- **Auto-calculate totals**: Total hours and billable hours
- **Lock/unlock mechanism**: Manager can unlock for editing
- **Entry linking**: Time entries linked to submissions
- **Timestamp tracking**: Submit, review, and modification timestamps

### 4. Role-Based Permissions

#### Admin
- Full CRUD on all entries
- Approve/reject/unlock any submission
- View all data across organization
- Manage projects and users
- Export capabilities

#### Manager
- Create/edit own entries
- Approve/reject/unlock team submissions
- View team entries and reports
- Export team data

#### Staff
- Create/edit own entries (before submission)
- Submit weeks for approval
- View own entries and history

#### Accountant
- Read-only access to all data
- Export capabilities
- View reports and analytics

### 5. Audit Logging
- **Comprehensive tracking**: All INSERT, UPDATE, DELETE, APPROVE, REJECT, UNLOCK actions
- **Field-level changes**: Old value → New value tracking
- **User attribution**: Changed by, timestamp, IP address
- **Database triggers**: Automatic logging on time entry changes
- **History views**: Complete audit trail per record

### 6. Dashboard Analytics
- **Summary metrics**: Total hours, billable hours, billable %, entry count
- **Hours by project**: Top 10 projects with bar charts
- **Hours by client**: Top 10 clients with aggregation
- **Work type distribution**: Pie/bar chart with billable breakdown
- **Staff × Work type matrix**: Heatmap showing staff work patterns
- **Filters**: Date range, employee, project, client, billable flag

## Database Schema

### Tables
1. **work_types** - Two-level work type hierarchy with billable flags
2. **projects** - Client projects with budget tracking
3. **time_entries** - Individual time records with audit fields
4. **weekly_submissions** - Weekly timesheet submissions with status
5. **audit_logs** - Complete change history
6. **user_roles** - Role assignments (admin/manager/staff/accountant)
7. **manager_assignments** - Manager-employee relationships

### Key Relationships
- Time entries → Projects (optional, required for non-leave)
- Time entries → Weekly submissions (linked on submit)
- Weekly submissions → Users (employee and reviewer)
- Audit logs → All tables (polymorphic tracking)

### Row Level Security (RLS)
- Staff can only view/edit own entries (if unsubmitted)
- Managers can view team entries
- Admins can view all entries
- Enforced at database level via Supabase RLS policies

## Installation & Setup

### 1. Database Setup

```bash
# Run schema creation
psql -U postgres -d nbe_portal -f lib/db/schema.sql

# Seed work types
psql -U postgres -d nbe_portal -f lib/db/seed-work-types.sql
```

### 2. Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Install Dependencies

```bash
npm install
# or
yarn install
```

### 4. Run Development Server

```bash
npm run dev
# Navigate to http://localhost:3000/timecard-enhanced
```

## Usage Examples

### Creating a Time Entry

```typescript
import { TimeEntryService } from '@/lib/services/timecard.service'

const entry = {
  entry_date: '2026-02-19',
  work_type_level1_id: 'FAB',
  work_type_level2_id: 'FRM',
  project_id: 'project-uuid',
  hours: 8.25,
  notes: 'Fabricated door frames for Project X'
}

const newEntry = await TimeEntryService.create(entry, userId)
```

### Submitting a Week

```typescript
import { WeeklySubmissionService } from '@/lib/services/timecard.service'

// Create submission for the week
const submission = await WeeklySubmissionService.create(
  userId,
  '2026-02-17' // Monday
)

// Submit for approval
await WeeklySubmissionService.submit(submission.id, userId)
```

### Manager Approval

```typescript
// Approve with comments
await WeeklySubmissionService.approve(
  submissionId,
  managerId,
  'All hours verified and approved'
)

// Or reject
await WeeklySubmissionService.reject(
  submissionId,
  managerId,
  'Please clarify overtime hours on Tuesday'
)
```

### Dashboard Analytics

```typescript
import { DashboardService } from '@/lib/services/timecard.service'

const filters = {
  start_date: '2026-02-01',
  end_date: '2026-02-28',
  employee_id: userId
}

const summary = await DashboardService.getSummary(filters)
const projectHours = await DashboardService.getHoursByProject(filters)
const workTypeMix = await DashboardService.getWorkTypeMix(filters)
```

## API Routes

### Time Entries
- `GET /api/timecard/entries` - List entries
- `POST /api/timecard/entries` - Create entry
- `PUT /api/timecard/entries/[id]` - Update entry
- `DELETE /api/timecard/entries/[id]` - Delete entry

### Weekly Submissions
- `POST /api/timecard/submissions/submit` - Submit week
- `POST /api/timecard/submissions/approve` - Approve submission
- `POST /api/timecard/submissions/reject` - Reject submission
- `POST /api/timecard/submissions/unlock` - Unlock for editing

### Dashboard
- `GET /api/timecard/dashboard/summary` - Get summary metrics
- `GET /api/timecard/dashboard/projects` - Get project hours
- `GET /api/timecard/dashboard/work-types` - Get work type mix

## Validation Rules

### Hours
- Must be greater than 0
- Must be in 0.25 increments (quarter hours)
- Cannot exceed 16 hours per day
- Validated both client and server side

### Work Types
- Level1 must be selected before Level2
- Level2 options filtered by Level1
- Billable flag auto-set from work type
- Leave types don't require project

### Weekly Submission
- Requires at least 1 time entry
- Cannot edit entries after submission
- Manager can unlock if needed (logged)
- Status transitions tracked in audit log

## Components

### TimeEntryForm
- Cascading work type dropdowns
- Project selection (conditional)
- Hours validation with 0.25 increment
- Auto billable flag indication
- Notes field

### WeeklySubmissionCard
- Week summary (entries, hours, billable)
- Status badge (draft/submitted/approved/rejected)
- Submit/approve/reject buttons (role-based)
- Manager comments display
- Unlock functionality

### DashboardAnalytics
- Summary KPI cards
- Bar charts for projects and clients
- Work type distribution table
- Staff × work type heatmap
- Date range filters
- Export functionality

## Testing

### Unit Tests

```typescript
// Test hours validation
describe('TimeEntryService.validateHoursIncrement', () => {
  it('should accept 0.25 increments', () => {
    expect(TimeEntryService.validateHoursIncrement(8.25)).toBe(true)
    expect(TimeEntryService.validateHoursIncrement(1.5)).toBe(true)
    expect(TimeEntryService.validateHoursIncrement(0.75)).toBe(true)
  })

  it('should reject invalid increments', () => {
    expect(TimeEntryService.validateHoursIncrement(8.3)).toBe(false)
    expect(TimeEntryService.validateHoursIncrement(1.1)).toBe(false)
  })
})

// Test daily hours limit
describe('TimeEntryService.validateHours', () => {
  it('should reject entries exceeding 16 hours per day', async () => {
    const result = await TimeEntryService.validateHours(
      userId,
      '2026-02-19',
      10 // When 8 already exists
    )
    expect(result.valid).toBe(false)
  })
})
```

### Integration Tests

```typescript
// Test submission flow
describe('Weekly Submission Flow', () => {
  it('should prevent editing after submission', async () => {
    // Create and submit
    const submission = await WeeklySubmissionService.create(userId, weekStart)
    await WeeklySubmissionService.submit(submission.id, userId)

    // Try to update entry
    await expect(
      TimeEntryService.update(entryId, { hours: 9 }, userId)
    ).rejects.toThrow()
  })
})
```

## Performance Considerations

1. **Indexes**: Created on frequently queried fields (employee_id, entry_date, project_id)
2. **Pagination**: Implement for large datasets in dashboard
3. **Caching**: Consider caching work types (rarely change)
4. **Query optimization**: Use select specific fields, avoid N+1 queries
5. **Batch operations**: Use multi-insert for bulk imports

## Security

1. **Row Level Security**: Enforced at database level
2. **Role validation**: Server-side permission checks
3. **Audit logging**: All changes tracked with user attribution
4. **SQL injection**: Prevented via parameterized queries (Supabase)
5. **XSS prevention**: React escapes values by default

## Deployment

### Production Checklist
- [ ] Run database migrations
- [ ] Seed work types data
- [ ] Configure RLS policies
- [ ] Set environment variables
- [ ] Test role permissions
- [ ] Verify audit logging
- [ ] Test submission workflow
- [ ] Configure backups
- [ ] Set up monitoring

## Troubleshooting

### Common Issues

**Issue**: Hours validation failing  
**Solution**: Ensure hours are in 0.25 increments (e.g., 8.25, not 8.3)

**Issue**: Cannot edit entry after submission  
**Solution**: Manager must unlock the weekly submission first

**Issue**: Work type Level2 dropdown empty  
**Solution**: Ensure Level1 is selected first

**Issue**: Project required error  
**Solution**: Project is mandatory for non-leave work types

## Future Enhancements

1. **Mobile app**: React Native version
2. **GPS tracking**: Location verification for field work
3. **Overtime alerts**: Automatic notifications for >40 hours
4. **Budget tracking**: Compare project actuals vs budget
5. **Approval workflows**: Multi-level approval chains
6. **Integration**: Connect to payroll systems
7. **Timesheets export**: PDF generation
8. **Biometric clock-in**: Fingerprint/face recognition

## Support

For issues or questions:
- Email: support@nbeaustralia.com
- Documentation: /docs/timecard
- GitHub Issues: [repository]/issues

## License

© 2026 NBE Australia. All rights reserved.
