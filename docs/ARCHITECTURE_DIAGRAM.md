# Timecard System - Data Flow & Architecture

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                            │
│                    (app/(portal)/timecard/page.tsx)              │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  Clock In/Out   │  │  GPS Location    │  │ Weekly Table   │ │
│  │    Controls     │  │     Display      │  │    Display     │ │
│  └────────┬────────┘  └─────────┬────────┘  └───────┬────────┘ │
│           │                     │                     │          │
└───────────┼─────────────────────┼─────────────────────┼──────────┘
            │                     │                     │
            │  onClick            │  useEffect          │  useEffect
            ▼                     ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EVENT HANDLERS                               │
│                                                                   │
│  handleStartShift()        checkActiveShift()    loadTimesheetData() │
│         │                         │                      │        │
│         ├─► requestGPSLocation()  │                      │        │
│         │                         │                      │        │
└─────────┼─────────────────────────┼──────────────────────┼────────┘
          │                         │                      │
          │ Calls                   │ Calls                │ Calls
          ▼                         ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                  │
│              (lib/services/timecard-clock.service.ts)            │
│                                                                   │
│  clockIn(userId, gps)     getActiveShift(userId)    getWeeklyTimecards(userId) │
│         │                         │                      │        │
│         │                         │                      │        │
│  Helper Functions:                                               │
│  - getCurrentWeekRange()                                         │
│  - calculateDuration()                                           │
│  - formatTime()                                                  │
│  - formatDate()                                                  │
│  - determineShiftType()                                          │
│  - calculateWeeklyTotal()                                        │
│                                                                   │
└─────────┼─────────────────────────┼──────────────────────┼────────┘
          │                         │                      │
          │ Supabase Query          │ Supabase Query       │ Supabase Query
          ▼                         ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                              │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    timecards TABLE                          │ │
│  │                                                             │ │
│  │  id (UUID)                    clock_in_gps_lat (DECIMAL)  │ │
│  │  user_id (UUID) ─► FK         clock_in_gps_lng (DECIMAL)  │ │
│  │  clock_in_time (TIMESTAMP)    clock_out_gps_lat (DECIMAL) │ │
│  │  clock_out_time (TIMESTAMP)   clock_out_gps_lng (DECIMAL) │ │
│  │  gps_accuracy (DECIMAL)       status (VARCHAR)            │ │
│  │  notes (TEXT)                 created_at (TIMESTAMP)      │ │
│  │                              updated_at (TIMESTAMP)       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Row Level Security (RLS) Policies:                              │
│  ✓ Users can view/insert/update their own timecards             │
│  ✓ Managers can view team timecards                             │
│  ✓ Admins can view all timecards                                │
│                                                                   │
│  Indexes:                                                         │
│  - idx_timecards_user (user_id)                                 │
│  - idx_timecards_user_date (user_id, clock_in_time)            │
│  - idx_timecards_status (status)                                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Clock-In Flow Diagram

```
┌─────────┐
│  User   │
│ Clicks  │
│"Start   │
│ Shift"  │
└────┬────┘
     │
     ▼
┌──────────────────────┐
│ handleStartShift()   │
│ - Check if user      │
│ - Set loading state  │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│requestGPSLocation()  │
│ - Request permission │
│ - Get coordinates    │
└────┬─────────────────┘
     │
     ├──► Permission Denied ─────┐
     │                           │
     ▼                           ▼
┌──────────────────────┐   ┌──────────────┐
│ GPS Coords Received  │   │ Show Error   │
│ - latitude           │   │ Message      │
│ - longitude          │   └──────────────┘
│ - accuracy           │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ TimecardService.clockIn()    │
│ - Insert to database:        │
│   * user_id                  │
│   * clock_in_time (NOW())    │
│   * clock_in_gps_lat         │
│   * clock_in_gps_lng         │
│   * gps_accuracy             │
│   * status = 'active'        │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ Database Insert              │
│ RLS Check:                   │
│ ✓ user_id = auth.uid()       │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ Update UI State              │
│ - setIsClockedIn(true)       │
│ - setSuccessMessage()        │
│ - checkActiveShift()         │
│ - loadTimesheetData()        │
└──────────────────────────────┘
```

## Clock-Out Flow Diagram

```
┌─────────┐
│  User   │
│ Clicks  │
│  "End   │
│ Shift"  │
└────┬────┘
     │
     ▼
┌──────────────────────┐
│ handleEndShift()     │
│ - Check if user      │
│ - Set loading state  │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ TimecardService.clockOut()   │
│ - Find active timecard:      │
│   WHERE user_id = ?          │
│   AND clock_out_time IS NULL │
│   AND status = 'active'      │
└────┬─────────────────────────┘
     │
     ├──► No Active Shift ───────┐
     │                           │
     ▼                           ▼
┌──────────────────────┐   ┌──────────────┐
│ Update Record:       │   │ Show Error   │
│ - clock_out_time     │   │ Message      │
│ - status='completed' │   └──────────────┘
└────┬─────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ Database Update              │
│ RLS Check:                   │
│ ✓ user_id = auth.uid()       │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────┐
│ Update UI State              │
│ - setIsClockedIn(false)      │
│ - setSuccessMessage()        │
│ - loadTimesheetData()        │
└──────────────────────────────┘
```

## Weekly Timesheet Load Flow

```
┌─────────────────┐
│ Page Load       │
│ or              │
│ User Auth       │
└────┬────────────┘
     │
     ▼
┌──────────────────────────────┐
│ loadTimesheetData()          │
│ - Check user authenticated   │
│ - Set loading state          │
└────┬─────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ TimecardService.getWeeklyTimecards() │
│ - Calculate week range:              │
│   * Monday (start)                   │
│   * Sunday (end)                     │
└────┬─────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ Query Database:                      │
│ SELECT * FROM timecards              │
│ WHERE user_id = ?                    │
│   AND clock_in_time >= Monday        │
│   AND clock_in_time <= Sunday        │
│ ORDER BY clock_in_time DESC          │
└────┬─────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ Transform Data:                      │
│ For each record:                     │
│ - Format date (formatDate)           │
│ - Format clock-in time (formatTime)  │
│ - Format clock-out time (formatTime) │
│ - Calculate duration                 │
│ - Determine shift type               │
│ - Set GPS status                     │
└────┬─────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ Calculate Weekly Total:              │
│ - Sum all durations                  │
│ - Format as "29h 47m"                │
└────┬─────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│ Update UI State:                     │
│ - setTimesheetData(transformed)      │
│ - setWeeklyTotal(total)              │
│ - setIsLoadingTimesheet(false)       │
└──────────────────────────────────────┘
```

## State Management Flow

```
┌─────────────────────────────────────┐
│         Component State              │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ isClockedIn: boolean           │ │
│  │ - True if active shift exists  │ │
│  │ - Updated by checkActiveShift()│ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ timesheetData: TimeEntry[]     │ │
│  │ - Array of weekly entries      │ │
│  │ - Updated by loadTimesheetData()│ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ weeklyTotal: string            │ │
│  │ - Formatted "29h 47m"          │ │
│  │ - Calculated from timesheetData│ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ isLoadingTimesheet: boolean    │ │
│  │ - Shows loading skeleton       │ │
│  │ - Set during data fetching     │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ errorMessage: string | null    │ │
│  │ - Displays error banner        │ │
│  │ - Auto-cleared after action    │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ successMessage: string | null  │ │
│  │ - Displays success banner      │ │
│  │ - Auto-cleared after 3 seconds │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Database Schema Details

```sql
CREATE TABLE timecards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL 
                        REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Time Tracking
    clock_in_time       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    clock_out_time      TIMESTAMP WITH TIME ZONE NULL,
    
    -- GPS Coordinates (Clock-In)
    clock_in_gps_lat    DECIMAL(10, 8) NULL,
    clock_in_gps_lng    DECIMAL(11, 8) NULL,
    
    -- GPS Coordinates (Clock-Out)
    clock_out_gps_lat   DECIMAL(10, 8) NULL,
    clock_out_gps_lng   DECIMAL(11, 8) NULL,
    
    -- GPS Metadata
    gps_accuracy        DECIMAL(10, 2) NULL,  -- meters
    
    -- Status & Notes
    status              VARCHAR(20) DEFAULT 'active' 
                        CHECK (status IN ('active', 'completed', 'cancelled')),
    notes               TEXT NULL,
    
    -- Timestamps
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Row Level Security (RLS) Policies

```
Policy: "Users can view own timecards"
FOR SELECT
USING (auth.uid() = user_id)
─────────────────────────────────────
User can only see their own records
Enforced automatically by Supabase

Policy: "Users can create own timecards"
FOR INSERT
WITH CHECK (auth.uid() = user_id)
─────────────────────────────────────
User can only create records for themselves
Prevents impersonation

Policy: "Users can update own timecards"
FOR UPDATE
USING (auth.uid() = user_id)
─────────────────────────────────────
User can only update their own records
Prevents tampering with others' data

Policy: "Managers can view team timecards"
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM manager_assignments
        WHERE manager_id = auth.uid()
        AND employee_id = timecards.user_id
    )
)
─────────────────────────────────────
Managers see team members' timecards
Based on manager_assignments table

Policy: "Admins can view all timecards"
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
)
─────────────────────────────────────
Admins have full access
Based on user_roles table
```

## Performance Optimization

```
┌─────────────────────────────────────┐
│           INDEXES                    │
├─────────────────────────────────────┤
│                                      │
│  idx_timecards_user                 │
│  ├─► Speeds up: user_id queries     │
│  └─► Used in: All RLS policies      │
│                                      │
│  idx_timecards_user_date            │
│  ├─► Speeds up: Weekly queries      │
│  └─► Composite index (user+date)    │
│                                      │
│  idx_timecards_status               │
│  ├─► Speeds up: Status filtering    │
│  └─► Used in: Active shift checks   │
│                                      │
│  idx_timecards_clock_in             │
│  ├─► Speeds up: Date range queries  │
│  └─► Used in: Weekly timesheet      │
│                                      │
└─────────────────────────────────────┘

Query Optimization:
✓ All queries include user_id for RLS
✓ Date range filtering uses indexes
✓ ORDER BY uses indexed columns
✓ LIMIT used to prevent large results
```

## Error Handling Strategy

```
┌─────────────────────────────────────┐
│      Error Type      │   Handler     │
├──────────────────────┼───────────────┤
│ GPS Permission       │ errorMessage  │
│ Denied               │ state         │
├──────────────────────┼───────────────┤
│ Network Failure      │ try/catch     │
│                      │ + errorMessage│
├──────────────────────┼───────────────┤
│ No Active Shift      │ Check before  │
│ (clock-out)          │ + errorMessage│
├──────────────────────┼───────────────┤
│ Already Clocked In   │ Check before  │
│                      │ + errorMessage│
├──────────────────────┼───────────────┤
│ Database Error       │ Supabase      │
│                      │ error handling│
├──────────────────────┼───────────────┤
│ Authentication       │ Redirect to   │
│ Required             │ login         │
└─────────────────────────────────────┘
```

## Data Transformation Pipeline

```
┌──────────────────────────────────────┐
│     Raw Database Record              │
├──────────────────────────────────────┤
│ {                                    │
│   id: "uuid-123",                    │
│   user_id: "uuid-456",               │
│   clock_in_time: "2024-01-15T08:00:00Z", │
│   clock_out_time: "2024-01-15T17:30:00Z", │
│   clock_in_gps_lat: -33.8688,        │
│   clock_in_gps_lng: 151.2093,        │
│   status: "completed"                │
│ }                                    │
└──────────────┬───────────────────────┘
               │
               ▼ Transform
┌──────────────────────────────────────┐
│     UI Display Format                │
├──────────────────────────────────────┤
│ {                                    │
│   id: "uuid-123",                    │
│   date: "Mon, Jan 15",               │
│   clockIn: "08:00 AM",               │
│   clockOut: "05:30 PM",              │
│   duration: "9h 30m",                │
│   totalHours: "9.5h",                │
│   shiftType: "Overtime",             │
│   gpsStatus: "verified"              │
│ }                                    │
└──────────────────────────────────────┘
```

## Integration Points

```
┌─────────────────────────────────────┐
│     Existing System                  │
├─────────────────────────────────────┤
│ - Supabase Auth (auth.users)        │
│ - TopNavigation Component           │
│ - Tailwind CSS Styling              │
│ - Lucide React Icons                │
└──────────────┬──────────────────────┘
               │
               ▼ Integrates With
┌─────────────────────────────────────┐
│     New Timecard System              │
├─────────────────────────────────────┤
│ - timecards Table                    │
│ - TimecardService Layer              │
│ - Clock-In/Out UI                    │
│ - Weekly Timesheet View              │
└─────────────────────────────────────┘
```
