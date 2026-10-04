import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Demo accounts created by `npm run db:seed` (local/CI databases only).
export const DEMO_PASSWORD = 'crewline-demo';
export const USERS = {
  manager: 'manager@harbourvine.test',
  maya: 'maya@harbourvine.test',
} as const;

const here = path.dirname(fileURLToPath(import.meta.url));
export const storageFor = (who: keyof typeof USERS) =>
  path.join(here, '..', '.auth', `${who}.json`);

/** A yyyy-MM-dd date `days` from today, in the browser's local calendar. */
export function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}
