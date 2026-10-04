export const NOTIFICATIONS_QUEUE = 'notifications';

export const JOB = {
  schedulePublished: 'schedule-published',
  shiftReminders: 'shift-reminders',
} as const;

export interface SchedulePublishedJob {
  organizationId: string;
  scheduleId: string;
  /** e.g. "Sep 28 – Oct 4" */
  weekLabel: string;
  republished: boolean;
}

/** How far ahead staff are reminded about a shift, and how often we check. */
export const REMINDER_LEAD_MINUTES = 120;
export const REMINDER_TICK_MINUTES = 5;
