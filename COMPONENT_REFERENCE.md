# Timecard Dashboard - Component Reference Guide

## File Structure

```
app/(portal)/
├── components/
│   ├── TimeEntryStartForm.tsx       ← Live time tracker card
│   ├── WeeklyActivityList.tsx       ← Activity history list
│   └── TopNavigation.tsx            ← (Existing)
├── timecard/
│   └── page.tsx                     ← Main dashboard page
└── (other pages...)

lib/
├── services/
│   └── timecard.service.ts          ← Database operations
├── types/
│   └── timecard.types.ts            ← Type definitions
└── supabase.ts                      ← Client initialization
```

## Component APIs

### TimeEntryStartForm
**Props:**
```typescript
interface TimeEntryStartFormProps {
  user?: { id?: string } | null
  onSuccess?: () => void
}
```

**Features:**
- Renders "Live Time Tracker Card"
- Manages work session start/stop lifecycle
- Cascading dropdown selection
- Real-time timer display
- Error handling with notifications

**Usage:**
```tsx
<TimeEntryStartForm 
  user={user} 
  onSuccess={() => refreshData()}
/>
```

---

### WeeklyActivityList
**Props:**
```typescript
interface WeeklyActivityListProps {
  entries: ActivityEntry[]
  isLoading?: boolean
}

interface ActivityEntry {
  id: string
  date: string
  dayOfWeek: string
  workType: {
    level1: string
    level1Code: string
    level2: string
    level2Code: string
  }
  client: string
  location: string
  startTime: string
  endTime: string
  duration: string
  status: 'completed' | 'active' | 'pending'
}
```

**Features:**
- Expandable day sections
- Responsive grid layout
- Status badges
- Action menu (future)
- Loading state

**Usage:**
```tsx
<WeeklyActivityList 
  entries={transformedEntries}
  isLoading={isLoading}
/>
```

---

## Key Utilities

### Tailwind Classes Used
```
Spacing: p-4 to p-12, gap-4 to gap-8, mb-1 to mb-8
Sizing: w-full, min-w-max, h-3 to h-12
Colors: slate-*, purple-*, emerald-*, red-*
Shadows: shadow-sm, shadow-md, shadow-lg, shadow-*-500/30
Borders: border, rounded-xl, rounded-2xl
Text: text-xs to text-4xl, font-black, font-bold, font-semibold
Backgrounds: bg-white, bg-gradient-to-r, from-* to-*
Transitions: transition-all, transition-colors, duration-200
Transforms: scale-*, translate-*, rotate-*
Displays: flex, grid, grid-cols-1, md:grid-cols-2, lg:grid-cols-4
```

### Animation Classes
```
hover:scale-105              ← Button hover scale
hover:shadow-lg              ← Hover shadow increase
active:scale-95              ← Click feedback
animate-spin                 ← Loading spinner
animate-pulse                ← Pulsing indicator
group-hover:*               ← Group hover effects
transition-all duration-200 ← Smooth transitions
```

---

## Styling Patterns

### Premium Card Pattern
```tsx
<div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 hover:shadow-md transition-all">
  {/* Content */}
</div>
```

### Button Pattern
```tsx
<button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 active:scale-95 transform hover:scale-105">
  {text}
</button>
```

### Timer Display Pattern
```tsx
<div className="text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-700">
  {elapsedTime}
</div>
```

### Status Badge Pattern
```tsx
<div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
  <CheckCircle size={16} className="text-emerald-600" />
  <span className="text-xs font-bold text-emerald-700 uppercase tracking-tight">Completed</span>
</div>
```

---

## Database Schema Integration

### Time Entries Table
```typescript
{
  id: string
  employee_id: string
  client_id: string
  location_id: string
  work_type_level1_id: string      ← Note: NOT level1_id
  work_type_level2_id: string      ← Note: NOT level2_id
  billable: boolean
  start_time: string (ISO 8601)
  end_time: string | null (ISO 8601)
  status: 'active' | 'completed'
  hours?: number
}
```

### Related Tables
- `work_type_level1`: id, code, name
- `work_type_level2`: id, level1_id, code, name, billable
- `clients`: id, client_name/name, code, active
- `client_locations`: id, client_id, suburb

---

## Service Methods

### TimeEntryService

```typescript
// Start new work entry
await TimeEntryService.startWork({
  employee_id: string
  client_id: string
  location_id: string
  work_type_level1_id: string
  work_type_level2_id: string
  billable: boolean
}): Promise<ActiveWorkEntry>

// End work entry
await TimeEntryService.endWork(
  entryId: string,
  startTime: string
): Promise<ActiveWorkEntry>
```

### WorkTypeService

```typescript
// Get all Level 1 work types
await WorkTypeService.getGroupedByLevel1(): Promise<WorkTypeLevel1[]>

// Get Level 2 types for a Level 1
await WorkTypeService.getLevel2ByLevel1(
  level1Id: string
): Promise<WorkTypeLevel2[]>

// Get billable flag
await WorkTypeService.getBillableFlag(
  level1_id: string,
  level2_id: string
): Promise<boolean>
```

### ClientService

```typescript
// Get all clients
await ClientService.getAll(): Promise<Client[]>
```

### ClientLocationService

```typescript
// Get locations by client
await ClientLocationService.getByClient(
  clientId: string
): Promise<ClientLocation[]>
```

---

## Customization Guide

### Change Primary Color
1. Update all `from-purple-*` / `to-purple-*` to desired color
2. Update `text-purple-*` references
3. Update focus states: `focus:ring-purple-*`
4. Search for `purple-500/50` shadow references

### Adjust Spacing
- Cards: Modify `p-8` (padding)
- Sections: Modify `space-y-8` and `gap-8`
- Compact: Use `p-4 space-y-4 gap-4`
- Relaxed: Use `p-12 space-y-12 gap-12`

### Change Border Radius
- Large cards: `rounded-2xl` → `rounded-3xl` or `rounded-lg`
- Buttons: `rounded-xl` → `rounded-full` for pill shape
- Small elements: `rounded-lg` → `rounded-md`

### Modify Animations
- Speed: Change `duration-200` → `duration-300` / `duration-150`
- Scale: Change `hover:scale-105` → `hover:scale-110`
- Add more: Use `transition-transform`, `transition-opacity`, etc.

---

## Common Tasks

### Add New Status Badge Type
```tsx
{status === 'pending' && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
    <Clock size={16} className="text-amber-600" />
    <span className="text-xs font-bold text-amber-700 uppercase tracking-tight">Pending</span>
  </div>
)}
```

### Add Loading Skeleton
```tsx
<div className="animate-pulse space-y-4">
  <div className="h-24 bg-gray-200 rounded-2xl"></div>
  <div className="h-12 bg-gray-200 rounded-xl"></div>
</div>
```

### Add Dark Mode Support
```tsx
className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
```

### Add Tooltip
```tsx
<button className="group relative">
  Button
  <div className="invisible group-hover:visible absolute bg-black text-white text-xs px-2 py-1 rounded">
    Tooltip text
  </div>
</button>
```

---

## Performance Tips

1. **Memoization:**
   - Use `useCallback` for event handlers
   - Use `useMemo` for expensive calculations

2. **Lazy Loading:**
   - Lazy load WeeklyActivityList with large datasets
   - Use virtualization for 1000+ entries

3. **Optimizations:**
   - Clean up intervals/timers in useEffect
   - Prevent unnecessary re-renders with dependency arrays
   - Use `React.memo` for list items

4. **Bundle Size:**
   - Lucide React icons are tree-shakeable (good)
   - Consider removing unused Tailwind classes
   - Use production builds

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Timer not updating | Check `useEffect` dependencies, ensure `activeEntry` changes trigger update |
| Styling not applying | Verify Tailwind config includes all paths, check for typos in class names |
| Dropdowns not cascading | Verify state updates trigger dependent queries |
| Animations stuttering | Check GPU acceleration, reduce animation complexity |
| Mobile layout broken | Test with actual mobile device, not just browser resize |
| TypeScript errors | Verify all imports, check field names match database schema |

---

Generated: February 19, 2026
