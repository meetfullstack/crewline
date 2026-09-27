export interface AvailabilityBlock {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

/**
 * Returns a human-readable problem with a weekly availability set, or null if
 * it is valid. Blocks must have positive length and must not overlap within a
 * day (an employee can't be both "preferred" and "unavailable" at 6pm).
 */
export function availabilityProblem(
  blocks: AvailabilityBlock[],
): string | null {
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (const block of blocks) {
    if (block.endMinute <= block.startMinute) {
      return `${DAY[block.dayOfWeek]}: end time must be after start time`;
    }
  }

  const byDay = new Map<number, AvailabilityBlock[]>();
  for (const block of blocks) {
    byDay.set(block.dayOfWeek, [...(byDay.get(block.dayOfWeek) ?? []), block]);
  }
  for (const [day, dayBlocks] of byDay) {
    const sorted = [...dayBlocks].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMinute < sorted[i - 1].endMinute) {
        return `${DAY[day]}: time ranges overlap`;
      }
    }
  }
  return null;
}
