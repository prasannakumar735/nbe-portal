export const NOTIFICATION_SETTING_DEFINITIONS = [
  {
    key: 'door_service_lead_time_days',
    label: 'Door service alert lead time (days)',
    description:
      'How many days before a door\'s service due date to email managers. Applies to the automated door service alert cron job.',
    defaultValue: 15,
    min: 1,
    max: 90,
    unit: 'days',
    type: 'numeric' as const,
  },
  {
    key: 'door_service_interval_months',
    label: 'Door service interval (months)',
    description:
      'How many months between door services. A door is considered overdue once this period has passed since its last inspection (or install date if never inspected).',
    defaultValue: 6,
    min: 1,
    max: 24,
    unit: 'months',
    type: 'numeric' as const,
  },
] as const

export const NOTIFICATION_TOGGLE_DEFINITIONS = [
  {
    key: 'reminder_notifications_enabled',
    label: 'Enable reminder notifications',
    description: 'When disabled, the daily cron job will not send any automated door service reminder emails.',
    defaultValue: true,
    type: 'toggle' as const,
  },
] as const

export const NOTIFICATION_EMAIL_LIST_DEFINITIONS = [
  {
    key: 'reminder_notification_recipients',
    label: 'Notification recipients',
    description: 'Custom email addresses to receive door service reminders. Only @nbeaustralia.com.au addresses are accepted. Leave empty to notify all portal managers and admins automatically.',
    defaultValue: '',
    type: 'email_list' as const,
  },
] as const

export type NotificationSettingKey =
  | (typeof NOTIFICATION_SETTING_DEFINITIONS)[number]['key']
  | (typeof NOTIFICATION_TOGGLE_DEFINITIONS)[number]['key']
  | (typeof NOTIFICATION_EMAIL_LIST_DEFINITIONS)[number]['key']
