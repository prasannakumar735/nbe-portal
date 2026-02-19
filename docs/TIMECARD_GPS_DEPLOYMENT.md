# Timecard GPS Clock-In/Out Integration - Deployment Guide

## Overview
This guide covers the deployment of the GPS-based timecard clock-in/out feature integrated with Supabase backend.

## Prerequisites
- Supabase project already set up
- Next.js application configured with Supabase client
- User authentication (Supabase Auth) already working

## Deployment Steps

### 1. Database Schema Setup

#### Apply the Timecards Table Migration
Run the following SQL in your Supabase SQL Editor:

```bash
# Navigate to Supabase Dashboard > SQL Editor
# Run the migration file: lib/db/migrations/001_add_timecards_table.sql
```

The migration creates:
- `timecards` table with GPS coordinates
- Indexes for performance optimization
- Row Level Security (RLS) policies
- Auto-update timestamp trigger

#### Verify Table Creation
```sql
-- Verify the table exists
SELECT * FROM timecards LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'timecards';
```

### 2. Service Layer Configuration

The timecard service is located at: `lib/services/timecard-clock.service.ts`

**Key Functions:**
- `getActiveShift(userId)` - Check if user has an active (uncompleted) shift
- `getWeeklyTimecards(userId)` - Fetch all timecards for current week (Monday-Sunday)
- `clockIn(userId, gpsCoords)` - Create new timecard with GPS location
- `clockOut(userId)` - Update active timecard with clock-out time

**Helper Functions:**
- `getCurrentWeekRange()` - Calculate Monday-Sunday date range
- `calculateDuration(clockIn, clockOut)` - Calculate hours worked
- `formatTime(timestamp)` - Format as 12-hour time with AM/PM
- `formatDate(timestamp)` - Format as "Mon, Oct 23"
- `determineShiftType(hours)` - Classify as Overtime/Full/Partial
- `calculateWeeklyTotal(timecards)` - Sum all hours for the week

### 3. Frontend Integration

The clock-in/out page is located at: `app/(portal)/timecard/page.tsx`

**Key Features:**
- Real-time GPS location tracking
- Active shift detection on page load
- Weekly timesheet display with loading states
- Success/error message notifications
- Responsive design with Tailwind CSS

**State Management:**
- `isClockedIn` - Current clock status (active shift)
- `timesheetData` - Array of weekly timecard entries
- `weeklyTotal` - Formatted string (e.g., "29h 47m")
- `isLoadingTimesheet` - Loading state for data fetching
- `errorMessage` / `successMessage` - User feedback messages

### 4. GPS Permission Requirements

The application requires GPS/location permissions. Users will see a browser prompt on first access.

**Permission Handling:**
```typescript
// Implemented in requestGPSLocation()
navigator.geolocation.getCurrentPosition(
  (position) => {
    // GPS granted - proceed with clock-in
  },
  (error) => {
    // GPS denied or error - show error message
  }
)
```

### 5. Testing the Integration

#### Test Clock-In Flow
1. Navigate to `/timecard`
2. Allow GPS location when prompted
3. Click "Start Shift" button
4. Verify:
   - Success message appears
   - Button changes to "End Shift"
   - GPS location displays on map

#### Test Clock-Out Flow
1. While clocked in, click "End Shift"
2. Verify:
   - Success message appears
   - New entry appears in Weekly Timesheet table
   - Duration is calculated correctly
   - Weekly total updates

#### Test Weekly Timesheet
1. Check table displays all entries for current week (Monday-Sunday)
2. Verify columns: Date, Clock In, Clock Out, Duration, Type, GPS Status
3. Verify weekly total at bottom of table

#### Test Loading States
1. Refresh page
2. Verify loading spinner appears while fetching data
3. Verify empty state when no entries exist

### 6. Row Level Security Verification

Test that RLS policies work correctly:

```sql
-- As a regular user, should only see own timecards
SELECT * FROM timecards WHERE user_id = auth.uid();

-- Should return no results if querying another user's data
SELECT * FROM timecards WHERE user_id != auth.uid();
```

### 7. Performance Optimization

The service layer uses optimized queries:

```typescript
// Efficient query with date range filtering
.eq('user_id', userId)
.gte('clock_in_time', weekStart)
.lte('clock_in_time', weekEnd)
.order('clock_in_time', { ascending: false })
```

**Indexes Utilized:**
- `idx_timecards_user` - User ID lookups
- `idx_timecards_user_date` - User + date range queries
- `idx_timecards_status` - Status filtering

### 8. Error Handling

The application handles various error scenarios:

| Error Type | Handling |
|------------|----------|
| GPS Permission Denied | Display error message with instructions |
| Network Failure | Show error toast, suggest retry |
| No Active Shift | Prevent clock-out, show info message |
| Already Clocked In | Prevent duplicate clock-in |
| Database Error | Log error, show user-friendly message |

### 9. Data Validation

**Clock-In Validation:**
- User must be authenticated
- GPS coordinates must be valid
- No active shift must exist

**Clock-Out Validation:**
- User must be authenticated
- Active shift must exist
- Clock-out time must be after clock-in time

### 10. Monitoring and Maintenance

#### Database Queries to Monitor
```sql
-- Check for orphaned active shifts (clocked in > 24 hours)
SELECT * FROM timecards 
WHERE status = 'active' 
AND clock_out_time IS NULL 
AND clock_in_time < NOW() - INTERVAL '24 hours';

-- Weekly timecard statistics
SELECT 
    user_id,
    COUNT(*) as total_shifts,
    SUM(EXTRACT(EPOCH FROM (clock_out_time - clock_in_time))/3600) as total_hours
FROM timecards
WHERE clock_in_time >= date_trunc('week', NOW())
AND clock_out_time IS NOT NULL
GROUP BY user_id;
```

## Troubleshooting

### Issue: GPS Not Working
**Solution:** Ensure HTTPS is enabled (required for geolocation API)

### Issue: RLS Preventing Access
**Solution:** Verify user authentication token is valid and not expired

### Issue: Week Range Incorrect
**Solution:** Check server timezone settings match expected timezone

### Issue: Duplicate Clock-In
**Solution:** Verify `getActiveShift()` check is working before allowing clock-in

## Security Considerations

1. **GPS Accuracy**: Store accuracy value for audit purposes
2. **RLS Policies**: Users can only access their own data
3. **Manager Access**: Managers can view team data via manager_assignments table
4. **Admin Access**: Admins have full access to all timecards
5. **Authentication**: All endpoints require valid Supabase auth token

## Next Steps

After deployment:
1. Monitor GPS accuracy in production
2. Set up alerts for orphaned active shifts
3. Create admin dashboard for timecard management
4. Add export functionality (PDF/CSV)
5. Implement timecard correction workflow
6. Add push notifications for shift reminders

## Support

For issues or questions:
- Check Supabase logs for database errors
- Review browser console for client-side errors
- Verify RLS policies are correctly applied
- Test with different user roles (staff, manager, admin)
