This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Local testing vs production DB (disable calendar emails)

Add to `.env.local` when testing locally against production Supabase data:

```bash
DISABLE_CALENDAR_NOTIFICATIONS=1
```

This skips Microsoft Graph emails for calendar notifications only (assigned events, reminder cron, `notifyCalendar*` in code). When unset, behaviour is unchanged — **do not set this in production** deployment env (remove from host secrets before release if you used it locally).

Helper: [`lib/notifications/isCalendarNotificationsDisabled.ts`](lib/notifications/isCalendarNotificationsDisabled.ts).

### Calendar multi-assignee rollout (`070_calendar_event_assignees.sql`)

1. Apply migration [`lib/db/migrations/070_calendar_event_assignees.sql`](lib/db/migrations/070_calendar_event_assignees.sql) (snapshot DB first).
2. Deploy API + cron + client (read path tolerates missing join table; writes require migration for managers syncing assignees).
3. **Rollback:** revert app code — `assigned_to` remains source of truth; join table safe to leave. DB restore only if migration caused issues.

**Manual QA:** create event with 2+ assignees; edit roster; overlap warning across shared crew; open `/job-card/{event}` as each technician; assignment + reminder emails (with `DISABLE_CALENDAR_NOTIFICATIONS` off in staging).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
