# Session summary — Office clock, timecard & UX (May 2026)

Persisted notes from implementation discussions for **NBE Portal** (`nbe-portal`). Use this as a quick reference for behaviour and file locations.

---

## Office QR attendance (`/office/clock`, `/api/office-clock/*`)

### Technician FAB task at sign-out

- **Server**: Technician = `profiles.role` `technician` or legacy `employee` (`isTechnician` in `lib/auth/roles.ts`).
- **POST `/api/office-clock/out`**: Optional JSON `workTypeLevel2Id`. If sent → must be an L2 under L1 code **FAB** (case-insensitive); L1 resolved from L2 `level1_id`. If omitted → `office_clock_sites.technician_default_work_type_level2_id` or env `OFFICE_CLOCK_TECHNICIAN_DEFAULT_WORK_TYPE_LEVEL2_ID` (merged in `lib/officeClock/envSiteFallback.ts`). Misconfigured default → **503**, invalid FAB task → **400**. Missing FAB override handled server-side so technicians still get a valid line when defaults exist.
- **GET `/api/office-clock/fab-tasks`**: `{ tasks: { id, name, level1_id }[] }` — FAB L2 only, sorted by name; authenticated; blocks `client` role.
- **GET `/api/office-clock/status`**: Adds `isTechnician`, `needsFabTask`.
- **UI**: `components/office/OfficeClockClient.tsx` — optional FAB task `<select>` when technician signed in; sign-out button label **“Sign out”** only.

### Notes narrative (office-created lines)

- Template (Melbourne wall time, `en-AU` 24h style):  
  `Logged in at …; logged out at …; worked on task: …`
- Shared helpers: `lib/officeClock/officeClockNarrative.ts`, insertion via `lib/officeClock/completeOfficeClockTimesheet.ts`.

### Forgotten sign-out (Melbourne)

- **Synthetic line**: 07:00–16:00 Melbourne on **Melbourne calendar date of `clock_in`**, break **30** min, `clock_out_at` at 16:00 Melbourne that day (`melbourneLocalYmdHmToUtc`).
- **Eligibility** (`lib/officeClock/forgottenSyntheticClose.ts`):
  - `clock_in` Melbourne date **before today** (Melbourne) → backlog close anytime cron/self runs.
  - **Same** Melbourne day → only after **≥ 17:00** Melbourne.
- **Cron**: `GET /api/office-clock/auto-close-forgotten` with `Authorization: Bearer <CRON_SECRET>`; uses service role client; idempotent via session `timesheet_entry_id IS NULL` conditional update.
- **Self-heal (no cron on localhost)**: `POST /api/office-clock/resolve-self-forgotten` — authenticated user closes own eligible session; `OfficeClockClient` calls this after status load when an open session exists.
- **Config**: `vercel.json` cron → `/api/office-clock/auto-close-forgotten` every ~10 minutes (requires `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` on host).

### Database

- Migration **`lib/db/migrations/062_office_clock_technician_default_fab_l2.sql`**: `office_clock_sites.technician_default_work_type_level2_id` (nullable FAB L2 reference).

---

## Timecards (`/dashboard/timecards`, `TimecardModal`)

- **Location optional**: `employee_timesheet_entries.location_id` may be null. If client has **no locations**, UI hides location dropdown and clears stale `location_id`; otherwise dropdown labelled optional with **“No location”**.
- **Manager/admin**: **Add new client** inline from modal (`POST /api/admin/clients`, optional first location `POST /api/admin/client-locations`); see `TimecardModal` + `TimecardApp`.
- **Notes**: Modal notes area **read-only** with short explanation; office clock writes narrative into `notes`.
- **Billable**: Helper subtitle under checkbox removed.

### Client search (large lists)

- **`components/ui/SearchableSelect.tsx`**: Searchable client picker; dropdown rendered via **`createPortal` to `document.body`** with **`position: fixed`** and **`z-index: 100`** so lists are **not clipped** by modal `overflow-hidden` / `overflow-y-auto` (fixes “search shows nothing” when changing client).

---

## Quotes

- Service quotes (`/dashboard/quotes/service`) use **text fields** (`customer_name`, `site_address`) via `/api/quotes/service` — no client FK dropdown in that flow; “phase 2 quotes” for locations did not require schema changes there.

---

## Operational checklist

1. Apply migration **062** in Supabase when deploying technician default column.
2. Set **`technician_default_work_type_level2_id`** (and/or env) per office site for technician fallback FAB task.
3. Production: **`CRON_SECRET`**, **`SUPABASE_SERVICE_ROLE_KEY`**, Vercel cron for auto-close.

---

## Key files (non-exhaustive)

| Area | Paths |
|------|--------|
| Office clock API | `app/api/office-clock/out/route.ts`, `fab-tasks`, `status`, `auto-close-forgotten`, `resolve-self-forgotten`, `sites` |
| Office clock UI | `components/office/OfficeClockClient.tsx`, `app/office/clock/page.tsx` |
| Shared logic | `lib/officeClock/*` (`completeOfficeClockTimesheet`, `fabWorkTypes`, `forgottenSyntheticClose`, `melbourneWallClock`, `officeClockNarrative`, `envSiteFallback`) |
| Timecard modal | `components/timecard/TimecardModal.tsx` |
| Timecard shell | `app/(portal)/timecard/TimecardApp.tsx` |
| Searchable select | `components/ui/SearchableSelect.tsx` |
| QR codes client pick | `app/(portal)/qr-codes/page.tsx` |

---

*End of persisted session summary.*
