# Quick Start Guide - Timecard GPS Integration

## 🚀 Get Started in 5 Minutes

### Step 1: Apply Database Migration (1 min)

1. Open Supabase Dashboard → SQL Editor
2. Run this file: `lib/db/migrations/001_add_timecards_table.sql`
3. Verify: Run `SELECT * FROM timecards LIMIT 1;`

### Step 2: Start Development Server (1 min)

```bash
npm run dev
```

Navigate to: `http://localhost:3000/timecard`

### Step 3: Test Clock-In (1 min)

1. Click "Start Shift" button
2. Allow GPS location when prompted
3. Verify success message appears
4. Check button changes to "End Shift"

### Step 4: Test Clock-Out (1 min)

1. Click "End Shift" button
2. Verify success message appears
3. Check new entry in Weekly Timesheet table
4. Verify weekly total updates

### Step 5: Verify Database (1 min)

In Supabase Dashboard:
```sql
SELECT 
  id,
  user_id,
  clock_in_time,
  clock_out_time,
  status
FROM timecards
ORDER BY clock_in_time DESC
LIMIT 5;
```

---

## 📁 Files You Need to Know

| File | Purpose |
|------|---------|
| `app/(portal)/timecard/page.tsx` | Main clock-in/out UI component |
| `lib/services/timecard-clock.service.ts` | Service layer with business logic |
| `lib/db/migrations/001_add_timecards_table.sql` | Database schema |
| `docs/TIMECARD_GPS_DEPLOYMENT.md` | Full deployment guide |
| `docs/INTEGRATION_SUMMARY.md` | What was changed and why |
| `docs/ARCHITECTURE_DIAGRAM.md` | Visual architecture diagrams |

---

## 🔧 Key Functions Reference

### Service Functions

```typescript
// Check if user has active shift
const activeShift = await TimecardService.getActiveShift(userId)
// Returns: TimecardRecord | null

// Get all timecards for current week
const weeklyData = await TimecardService.getWeeklyTimecards(userId)
// Returns: TimecardRecord[]

// Clock in with GPS
const record = await TimecardService.clockIn(userId, {
  latitude: -33.8688,
  longitude: 151.2093,
  accuracy: 10
})
// Returns: TimecardRecord

// Clock out
const updated = await TimecardService.clockOut(userId)
// Returns: TimecardRecord
```

### Helper Functions

```typescript
// Calculate current week range (Monday-Sunday)
const { start, end } = TimecardService.getCurrentWeekRange()

// Format timestamp as "08:30 AM"
const time = TimecardService.formatTime("2024-01-15T08:30:00Z")

// Format timestamp as "Mon, Jan 15"
const date = TimecardService.formatDate("2024-01-15T08:30:00Z")

// Calculate duration as "8h 30m"
const duration = TimecardService.calculateDuration(clockIn, clockOut)

// Determine shift type (Overtime/Full/Partial)
const type = TimecardService.determineShiftType(8.5)

// Calculate weekly total as "40h 15m"
const total = TimecardService.calculateWeeklyTotal(timecards)
```

---

## 🎨 UI Components

### Clock Button States

```tsx
{!isClockedIn ? (
  <button onClick={handleStartShift} disabled={isClockingIn}>
    Start Shift
  </button>
) : (
  <button onClick={handleEndShift} disabled={isClockingOut}>
    End Shift
  </button>
)}
```

### Loading State

```tsx
{isLoadingTimesheet ? (
  <div>Loading...</div>
) : (
  <table>{/* timesheet data */}</table>
)}
```

### Notification Banners

```tsx
{errorMessage && (
  <div className="bg-red-50 text-red-700">
    {errorMessage}
  </div>
)}

{successMessage && (
  <div className="bg-emerald-50 text-emerald-700">
    {successMessage}
  </div>
)}
```

---

## 🔒 Security Features

### Row Level Security (RLS)

All queries automatically filtered by:
```sql
WHERE user_id = auth.uid()
```

### Policies Applied

- ✅ Users see only their own timecards
- ✅ Managers see team timecards
- ✅ Admins see all timecards
- ✅ No direct database access without auth

---

## 🐛 Common Issues & Solutions

### Issue: GPS not working

**Cause:** HTTPS required for geolocation API  
**Solution:** 
- Development: Use `localhost` (HTTPS not required)
- Production: Ensure SSL certificate is valid

### Issue: "No active shift" error on clock-out

**Cause:** No open timecard found  
**Solution:**
```typescript
// Check before clock-out
const active = await TimecardService.getActiveShift(userId)
if (!active) {
  setErrorMessage("No active shift found")
  return
}
```

### Issue: RLS blocking queries

**Cause:** User not authenticated  
**Solution:**
```typescript
// Verify auth before queries
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  router.push('/auth/login')
  return
}
```

### Issue: Week range showing wrong dates

**Cause:** Timezone mismatch  
**Solution:** All timestamps use `WITH TIME ZONE` and UTC

---

## 📊 Database Queries for Monitoring

### Check Active Shifts

```sql
SELECT 
  user_id,
  clock_in_time,
  EXTRACT(EPOCH FROM (NOW() - clock_in_time))/3600 as hours_active
FROM timecards
WHERE status = 'active'
AND clock_out_time IS NULL
ORDER BY clock_in_time DESC;
```

### Weekly Statistics

```sql
SELECT 
  user_id,
  COUNT(*) as total_shifts,
  ROUND(SUM(EXTRACT(EPOCH FROM (clock_out_time - clock_in_time))/3600)::numeric, 2) as total_hours
FROM timecards
WHERE clock_in_time >= date_trunc('week', NOW())
AND clock_out_time IS NOT NULL
GROUP BY user_id;
```

### GPS Accuracy Report

```sql
SELECT 
  AVG(gps_accuracy) as avg_accuracy,
  MIN(gps_accuracy) as best_accuracy,
  MAX(gps_accuracy) as worst_accuracy
FROM timecards
WHERE gps_accuracy IS NOT NULL
AND clock_in_time >= NOW() - INTERVAL '7 days';
```

---

## 🧪 Testing Checklist

### Functional Tests

- [ ] Clock-in creates database record
- [ ] Clock-out updates record with end time
- [ ] GPS coordinates are captured
- [ ] Weekly timesheet loads on page load
- [ ] Active shift detected on refresh
- [ ] Weekly total calculates correctly
- [ ] Loading states display properly
- [ ] Error messages display on failures
- [ ] Success messages display on actions

### Security Tests

- [ ] User A cannot see User B's timecards
- [ ] Unauthenticated users redirected to login
- [ ] RLS policies enforced on all queries
- [ ] Cannot clock in/out for another user
- [ ] Cannot modify another user's records

### Edge Cases

- [ ] Handle GPS permission denied gracefully
- [ ] Handle network failures gracefully
- [ ] Handle duplicate clock-in attempts
- [ ] Handle clock-out without active shift
- [ ] Handle page refresh during operation
- [ ] Handle expired auth tokens

---

## 🔄 Data Flow Summary

```
User Action → Event Handler → Service Function → Database Query
     ↓              ↓               ↓                ↓
  Click         handleFn()    TimecardService     Supabase
                    ↓               ↓                ↓
              State Update    Transform Data    RLS Check
                    ↓               ↓                ↓
               UI Re-render   Format Output    Return Results
```

---

## 📝 Environment Setup

### Required Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Configuration

1. Enable Row Level Security on `timecards` table
2. Apply all policies from migration file
3. Verify indexes are created
4. Test with different user roles

---

## 🎯 Next Steps After Integration

### Immediate

1. Test with real GPS coordinates
2. Verify RLS with multiple users
3. Monitor database performance
4. Check error logging

### Short Term

1. Add admin dashboard for management
2. Implement timecard correction workflow
3. Add export functionality (PDF/CSV)
4. Set up alerts for orphaned shifts

### Long Term

1. Add geofencing (validate location)
2. Integrate with payroll system
3. Add reporting and analytics
4. Mobile app for easier access

---

## 💡 Pro Tips

### Performance

- Queries are optimized with indexes
- RLS policies are efficient
- Date range filtering prevents large results
- Loading states prevent UI blocking

### User Experience

- Success messages auto-dismiss after 3 seconds
- Error messages persist until dismissed
- Loading skeletons maintain layout
- Empty states guide users

### Debugging

- Check browser console for JS errors
- Check Supabase logs for DB errors
- Verify GPS permissions in browser settings
- Test with Chrome DevTools Location Override

---

## 📞 Support Resources

- **Full Documentation:** `docs/TIMECARD_GPS_DEPLOYMENT.md`
- **Integration Details:** `docs/INTEGRATION_SUMMARY.md`
- **Architecture:** `docs/ARCHITECTURE_DIAGRAM.md`
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs

---

## ✅ Success Indicators

You'll know it's working when:

✅ Clock-in button creates database record  
✅ GPS coordinates are captured accurately  
✅ Clock-out button updates the record  
✅ Weekly timesheet displays real data  
✅ Weekly total calculates correctly  
✅ Loading states work smoothly  
✅ Error handling works as expected  
✅ RLS prevents unauthorized access  
✅ Page refresh maintains state  
✅ Multiple shifts work correctly  

---

## 🎉 You're Done!

The timecard GPS integration is complete. Test thoroughly and deploy with confidence!

For questions or issues, refer to the comprehensive documentation in the `docs/` folder.
