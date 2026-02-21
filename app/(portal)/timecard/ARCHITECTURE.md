# Enterprise Timecard Module - Architecture Documentation

## Overview

The NBE Portal Timecard module has been refactored into a professional enterprise-grade UI following Fortune 500 internal tool standards. The architecture emphasizes clean component separation, TypeScript type safety, and production-ready patterns.

---

## Design System

### Color Palette (Enterprise)
```
Primary Brand:    indigo-900, indigo-800 (hero gradient)
Accent Success:   emerald-500, emerald-600
Danger:           red-600, red-700
Neutral Gray:     slate-50, slate-100, slate-600
Card Background:  white
Border:           slate-200, slate-300
Text Primary:     slate-900
Text Secondary:   slate-600, slate-500
```

### Spacing Scale (8px Grid)
```
Gap/Padding:      4px, 8px, 16px, 24px, 32px, 48px
Card Padding:     p-6 (24px)
Section Spacing:  space-y-8 (32px)
Border Radius:    rounded-lg (8px), rounded-xl (12px)
```

### Typography
```
H1 Hero:          text-3xl font-semibold tracking-tight
H2 Section:       text-xl font-semibold
Labels:           text-sm font-medium
Body:             text-sm
Timer Display:    text-5xl font-bold font-mono
```

---

## Component Architecture

### File Structure
```
app/(portal)/timecard/
├── page.tsx                          ← Main orchestrator
├── page-old.tsx                      ← Backup of previous implementation
└── components/
    ├── index.ts                      ← Centralized exports
    ├── StatusBadge.tsx               ← Reusable status indicator
    ├── TimecardHero.tsx              ← Hero section
    ├── ActiveSessionCard.tsx         ← Live timer & session details
    ├── TimecardSummaryCards.tsx      ← Week stats grid
    ├── TimeEntryForm.tsx             ← Work entry form
    ├── WeeklyActivityTable.tsx       ← Activity history table
    └── WeekNavigation.tsx            ← Week selector & filters
```

---

## Component APIs

### 1. StatusBadge
**Purpose:** Uniform status indicators across the application

```typescript
type BadgeStatus = 'completed' | 'active' | 'pending' | 'cancelled'

interface StatusBadgeProps {
  status: BadgeStatus
  size?: 'sm' | 'md'
}

// Usage
<StatusBadge status="completed" size="sm" />
```

**Features:**
- Automatic icon selection (CheckCircle, Clock, XCircle)
- Semantic colors per status
- Consistent sizing

---

### 2. TimecardHero
**Purpose:** Header section with title and active status indicator

```typescript
interface TimecardHeroProps {
  isActiveSession: boolean
}

// Usage
<TimecardHero isActiveSession={!!activeEntry} />
```

**Features:**
- Gradient indigo background
- Animated pulse dot when session active
- Responsive layout

---

### 3. ActiveSessionCard
**Purpose:** Live timer card with session controls

```typescript
interface ActiveSession {
  id: string
  client: string
  location: string
  workType: string
  task: string
  startTime: string
}

interface ActiveSessionCardProps {
  session: ActiveSession
  onStop: () => Promise<void>
  onComplete: () => Promise<void>
}

// Usage
<ActiveSessionCard 
  session={sessionData}
  onStop={handleStop}
  onComplete={handleComplete}
/>
```

**Features:**
- Auto-updating timer (1-second interval)
- Left accent border (indigo-600)
- Two action buttons (Stop/Complete)
- Responsive 3-section layout
- Processing state handling

---

### 4. TimecardSummaryCards
**Purpose:** Week summary statistics

```typescript
interface SummaryData {
  entriesThisWeek: number
  totalHours: number
  billableHours: number
}

interface TimecardSummaryCardsProps {
  data: SummaryData
  isLoading?: boolean
}

// Usage
<TimecardSummaryCards data={summaryData} isLoading={false} />
```

**Features:**
- 3-column grid (responsive to 1-column mobile)
- Icon + label + value pattern
- Loading skeleton state
- Hover shadow effect

---

### 5. TimeEntryForm
**Purpose:** Work session start form with cascading dropdowns

```typescript
interface TimeEntryFormProps {
  clients: DropdownOption[]
  workTypes: DropdownOption[]
  isDisabled?: boolean
  onSubmit: (data: FormData) => Promise<void>
  onClientChange: (clientId: string) => Promise<DropdownOption[]>
  onWorkTypeChange: (workTypeId: string) => Promise<DropdownOption[]>
}

// Usage
<TimeEntryForm
  clients={clientList}
  workTypes={workTypeList}
  isDisabled={hasActiveSession}
  onSubmit={handleStartWork}
  onClientChange={loadLocations}
  onWorkTypeChange={loadTasks}
/>
```

**Features:**
- Client → Location cascade
- Work Type → Task cascade
- Real-time validation
- Billable toggle
- Description textarea
- Form auto-reset after submit
- Disabled state when session active

---

### 6. WeeklyActivityTable
**Purpose:** Activity history table

```typescript
interface WeeklyEntry {
  id: string
  date: string
  client: string
  workType: string
  task: string
  startTime: string
  endTime: string | null
  duration: number | null
  status: BadgeStatus
}

interface WeeklyActivityTableProps {
  entries: WeeklyEntry[]
  isLoading?: boolean
}

// Usage
<WeeklyActivityTable entries={tableData} isLoading={false} />
```

**Features:**
- Responsive table (horizontal scroll on mobile)
- Empty state UI
- Row hover effect
- Duration formatting (Xh Ym)
- Status badge integration
- Zebra striping

---

### 7. WeekNavigation
**Purpose:** Week selector with filters and export

```typescript
interface WeekNavigationProps {
  currentWeekStart: Date
  onPreviousWeek: () => void
  onNextWeek: () => void
  onExport?: () => void
  showBillableOnly: boolean
  onToggleBillable: (checked: boolean) => void
}

// Usage
<WeekNavigation
  currentWeekStart={weekStart}
  onPreviousWeek={handlePrev}
  onNextWeek={handleNext}
  onExport={handleExport}
  showBillableOnly={billableFilter}
  onToggleBillable={setBillableFilter}
/>
```

**Features:**
- Previous/Next week navigation
- Current week indicator
- Next disabled when at current week
- Billable-only filter toggle
- CSV export button
- Week range display

---

## Data Flow

### Page Orchestration Pattern
```
page.tsx (Orchestrator)
  ├── Manages user auth state
  ├── Loads base dropdown options (clients, work types)
  ├── Loads time entries from Supabase
  ├── Maintains lookup maps for display
  ├── Computes derived data (summaries, filtered lists)
  └── Provides callbacks to child components
```

### State Management
```typescript
// Core Data
- user: User object
- entries: TimeEntry[] (all loaded entries)
- activeEntry: TimeEntry | null (currently running)

// Dropdown Options
- clients: Client[]
- workTypesL1: WorkTypeLevel1[]

// Lookup Maps (for display)
- clientLookup: Record<string, Client>
- locationLookup: Record<string, ClientLocation>
- level1Lookup: Record<string, WorkTypeLevel1>
- level2Lookup: Record<string, WorkTypeLevel2>

// UI State
- isLoadingPage: boolean
- errorMessage: string | null
- successMessage: string | null

// Filters
- currentWeekStart: Date
- showBillableOnly: boolean
```

### Computed Data (useMemo)
```typescript
// Summary data filtered by selected week and billable toggle
const summaryData = useMemo(() => {...}, 
  [entries, currentWeekStart, showBillableOnly])

// Table rows transformed with lookups
const weeklyTableData = useMemo(() => {...},
  [entries, clientLookup, level1Lookup, level2Lookup, currentWeekStart, showBillableOnly])

// Active session details
const activeSessionData = useMemo(() => {...},
  [activeEntry, clientLookup, locationLookup, level1Lookup, level2Lookup])
```

---

## Database Integration

### Supabase Queries

**Load Time Entries:**
```typescript
const { data, error } = await supabase
  .from('time_entries')
  .select('*')
  .eq('employee_id', userId)
  .order('start_time', { ascending: false })
  .limit(50)
```

**Start Work Session:**
```typescript
const { error } = await supabase
  .from('time_entries')
  .insert({
    employee_id: userId,
    client_id: clientId,
    location_id: locationId,
    level1_id: workTypeLevel1Id,
    level2_id: workTypeLevel2Id,
    billable: true,
    start_time: new Date().toISOString(),
    status: 'active'
  })
```

**Stop Work Session:**
```typescript
const now = new Date()
const start = new Date(activeEntry.start_time)
const hours = (now - start) / 3600000

const { error } = await supabase
  .from('time_entries')
  .update({
    end_time: now.toISOString(),
    hours: parseFloat(hours.toFixed(2)),
    status: 'completed'
  })
  .eq('id', activeEntry.id)
```

---

## User Flows

### 1. Start Work Session
```
User fills form → Validation → Insert to DB → Reload entries → 
  Show success message → Form resets → Active card appears
```

### 2. Stop Work Session
```
User clicks Stop → Calculate duration → Update DB → Reload entries → 
  Show success message → Active card disappears
```

### 3. Week Navigation
```
User clicks Previous/Next → Update currentWeekStart → 
  useMemo recalculates filtered data → Table refreshes
```

### 4. Export to CSV
```
User clicks Export → Generate CSV from weeklyTableData → 
  Create blob → Trigger download
```

---

## Responsive Breakpoints

```
Mobile (<640px):
- Single column layouts
- Stacked cards
- Horizontal scroll tables
- Full-width buttons

Tablet (640px-1024px):
- 2-column form grids
- Horizontal navigation

Desktop (1024px+):
- 3-column summary cards
- Side-by-side layouts
- Max-width: 1280px centered
```

---

## Performance Optimizations

1. **Memoization:**
   - Table data computed once per dependency change
   - Avoids recalculating lookups on every render

2. **Efficient Lookups:**
   - Maps instead of array.find() for O(1) access
   - Pre-built during initial load

3. **Lazy Loading:**
   - Locations loaded only when client selected
   - Tasks loaded only when work type selected

4. **Cleanup:**
   - Timer intervals cleared on unmount
   - Prevents memory leaks

---

## Error Handling

### Pattern
```tsx
try {
  // DB operation
} catch (error: any) {
  setErrorMessage(error.message || 'Operation failed')
  throw error // Re-throw for form handling
} finally {
  setIsSubmitting(false)
}
```

### User Feedback
- Success messages (green alert) auto-display
- Error messages (red alert) show specific issues
- Loading states prevent double-submission

---

## Future Enhancements

1. **Real-time Updates:** Supabase subscriptions for multi-user sync
2. **GPS Integration:** Location tracking during sessions
3. **Approval Workflow:** Manager review of submissions
4. **Advanced Filters:** Date range, client, project
5. **Analytics Dashboard:** Charts and trends
6. **Offline Support:** Service worker for offline entry creation

---

## Testing Checklist

- [ ] Start work session (all fields required)
- [ ] Stop active session (calculates duration correctly)
- [ ] Timer updates every second
- [ ] Only one active session allowed
- [ ] Week navigation (previous/next)
- [ ] Billable filter toggles correctly
- [ ] CSV export downloads with correct data
- [ ] Form validation blocks incomplete submissions
- [ ] Cascading dropdowns populate correctly
- [ ] Mobile responsive (test on actual device)
- [ ] Loading states display during operations
- [ ] Error messages show on failures
- [ ] Success messages clear after new action

---

**Generated:** February 21, 2026  
**Version:** 1.0 Enterprise Refactor  
**Next.js:** 16.1.6  
**Supabase:** Latest Client
