import { DAY_NAMES } from "./format";
import type { AvailabilityBlock } from "./types";

/** Mirrors the API check so problems show up before saving. */
export function availabilityProblem(blocks: AvailabilityBlock[]): string | null {
  for (const block of blocks) {
    if (block.endMinute <= block.startMinute) {
      return `${DAY_NAMES[block.dayOfWeek]}: end time must be after start time`;
    }
  }
  for (let day = 0; day < 7; day++) {
    const sorted = blocks
      .filter((b) => b.dayOfWeek === day)
      .sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMinute < sorted[i - 1].endMinute) {
        return `${DAY_NAMES[day]}: time ranges overlap`;
      }
    }
  }
  return null;
}

/** Monday-first display order for a restaurant week. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
