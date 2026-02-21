# 🏢 Enterprise Timecard Module

> Professional internal time tracking system built with Next.js 16, TypeScript, Supabase, and Tailwind CSS

## ✨ Features

- **Live Time Tracking:** Auto-updating timer with session management
- **Cascading Dropdowns:** Client → Location, Work Type → Task
- **Week Navigation:** Browse historical data week by week
- **Smart Filtering:** Billable-only toggle
- **CSV Export:** Download weekly reports
- **Summary Dashboard:** Entries count, total hours, billable hours
- **Responsive Design:** Mobile-first, works on all devices
- **Enterprise UI:** Clean, professional, no clutter

---

## 🚀 Quick Start

### Run Development Server
```bash
npm run dev
```

Navigate to: `http://localhost:3000/timecard`

### Build for Production
```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
app/(portal)/timecard/
├── page.tsx                    # Main page orchestrator
├── ARCHITECTURE.md             # Detailed architecture docs
├── README.md                   # This file
└── components/
    ├── index.ts                # Component exports
    ├── StatusBadge.tsx         # Status indicators
    ├── TimecardHero.tsx        # Hero section
    ├── ActiveSessionCard.tsx   # Live timer card
    ├── TimecardSummaryCards.tsx # Week stats
    ├── TimeEntryForm.tsx       # Work entry form
    ├── WeeklyActivityTable.tsx # Activity history
    └── WeekNavigation.tsx      # Week selector
```

---

## 🎨 Design System

### Colors (Enterprise Palette)
- **Primary:** `indigo-900`, `indigo-800` (brand)
- **Success:** `emerald-500`, `emerald-600` (active states)
- **Danger:** `red-600`, `red-700` (stop actions)
- **Neutral:** `slate-50` to `slate-900` (backgrounds, text)

### Spacing (8px Grid)
- Cards: `p-6` (24px)
- Sections: `space-y-8` (32px)
- Gaps: `gap-4`, `gap-6`, `gap-8`

### Components
All components follow consistent patterns:
- Rounded corners (`rounded-xl`)
- Subtle shadows (`shadow-sm`)
- Smooth transitions (`duration-200`)
- Accessible focus states

---

## 🔧 Component Usage

### Import Components
```typescript
import {
  TimecardHero,
  ActiveSessionCard,
  TimecardSummaryCards,
  TimeEntryForm,
  WeeklyActivityTable,
  WeekNavigation,
  StatusBadge
} from './components'
```

### Basic Example
```tsx
<TimecardHero isActiveSession={hasActiveSession} />

<TimecardSummaryCards data={{
  entriesThisWeek: 12,
  totalHours: 38.5,
  billableHours: 32.0
}} />

<StatusBadge status="completed" size="sm" />
```

---

## 💾 Database Schema

### `time_entries` Table
```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  location_id UUID NOT NULL REFERENCES client_locations(id),
  level1_id UUID NOT NULL REFERENCES work_type_level1(id),
  level2_id UUID NOT NULL REFERENCES work_type_level2(id),
  billable BOOLEAN NOT NULL DEFAULT true,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  hours NUMERIC(5,2),
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Required Lookup Tables
- `clients` (id, name)
- `client_locations` (id, client_id, suburb)
- `work_type_level1` (id, code, name)
- `work_type_level2` (id, level1_id, code, name, billable)

---

## 🔐 Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 📊 Data Flow

1. **Page Load:**
   - Authenticate user
   - Load clients & work types
   - Load time entries (last 50)
   - Build lookup maps

2. **Start Work:**
   - Validate form
   - Insert to `time_entries`
   - Reload entries
   - Show active session card

3. **Stop Work:**
   - Calculate duration
   - Update entry with end_time & hours
   - Reload entries
   - Hide active session card

4. **Week Navigation:**
   - Change `currentWeekStart` state
   - Filter entries by date range
   - Recalculate summaries

---

## 🎯 Key Features Explained

### Live Timer
Updates every second using `setInterval`:
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    // Calculate elapsed time
  }, 1000)
  return () => clearInterval(interval)
}, [session.startTime])
```

### Cascading Dropdowns
Parent selection triggers child load:
```typescript
useEffect(() => {
  if (selectedClient) {
    onClientChange(selectedClient).then(setLocations)
  }
}, [selectedClient])
```

### CSV Export
Generates CSV and triggers download:
```typescript
const csvContent = entries.map(row => row.join(',')).join('\n')
const blob = new Blob([csvContent], { type: 'text/csv' })
const url = window.URL.createObjectURL(blob)
// Trigger download...
```

---

## 🧪 Testing

### Manual Test Checklist
- [ ] Start work (all fields required)
- [ ] Timer updates in real-time
- [ ] Stop work (duration calculated)
- [ ] Only one active session allowed
- [ ] Week navigation works
- [ ] Billable filter toggles
- [ ] CSV export downloads
- [ ] Mobile responsive
- [ ] Form validation blocks submission
- [ ] Error messages display

### Unit Test Structure (Future)
```typescript
describe('TimeEntryForm', () => {
  it('should validate required fields', async () => {
    // Test implementation
  })
  
  it('should cascade location dropdown when client selected', async () => {
    // Test implementation
  })
})
```

---

## 🐛 Troubleshooting

### Timer Not Updating
- **Check:** `useEffect` cleanup is running
- **Fix:** Ensure `activeEntry` state changes trigger re-render

### Dropdowns Not Cascading
- **Check:** Parent state change triggers `useEffect`
- **Fix:** Add dependencies to `useEffect` array

### Validation Not Working
- **Check:** Form submit handler runs validation
- **Fix:** Call `validate()` before `onSubmit()`

### Styling Not Applying
- **Check:** Tailwind config includes all paths
- **Fix:** Add `app/**/*.{ts,tsx}` to `tailwind.config.ts`

---

## 📈 Performance

### Optimizations Applied
- **useMemo:** Computed data cached between renders
- **Lookup Maps:** O(1) lookups instead of array.find()
- **Lazy Loading:** Dependent dropdowns load on-demand
- **Cleanup:** Timer intervals cleared on unmount

### Profiling Tips
```typescript
// Add React DevTools Profiler
import { Profiler } from 'react'

<Profiler id="TimeEntryForm" onRender={logRenderTime}>
  <TimeEntryForm {...props} />
</Profiler>
```

---

## 🚦 Production Readiness

### Completed ✅
- [x] TypeScript strict mode
- [x] Component separation
- [x] Error handling
- [x] Loading states
- [x] Responsive design
- [x] Production build passes
- [x] Clean code (no console.logs)
- [x] Documentation

### Nice-to-Have (Future)
- [ ] Unit tests (Jest + React Testing Library)
- [ ] E2E tests (Playwright)
- [ ] Storybook component library
- [ ] Performance monitoring (Sentry)
- [ ] A11y audit

---

## 📚 Additional Resources

- **Full Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Component Reference:** See [COMPONENT_REFERENCE.md](../../COMPONENT_REFERENCE.md)
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs

---

## 🤝 Contributing

### Code Style
- Use TypeScript strict mode
- Follow existing component patterns
- Add JSDoc comments for complex logic
- Keep components under 300 lines

### Git Workflow
```bash
git checkout -b feature/your-feature
# Make changes
git commit -m "feat: add new feature"
git push origin feature/your-feature
# Open PR
```

---

## 📝 License

Internal NBE Portal Project - Not for public distribution

---

**Built with ❤️ by the NBE Engineering Team**  
**Last Updated:** February 21, 2026
