/**
 * Local testing: set `DISABLE_CALENDAR_NOTIFICATIONS=1` in `.env.local` to skip
 * calendar-related Microsoft Graph emails (assign + reminder cron paths).
 *
 * Do **not** set this in production. When unset/falsy, notifications behave as usual.
 */
export function isCalendarNotificationsDisabled(): boolean {
  return process.env.DISABLE_CALENDAR_NOTIFICATIONS === '1'
}
