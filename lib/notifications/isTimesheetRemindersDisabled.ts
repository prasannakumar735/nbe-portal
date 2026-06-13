/**
 * Local testing: set `DISABLE_TIMESHEET_REMINDERS=1` in `.env.local` to skip
 * weekly timesheet reminder / auto-submit / digest cron emails.
 */
export function isTimesheetRemindersDisabled(): boolean {
  return process.env.DISABLE_TIMESHEET_REMINDERS === '1'
}
