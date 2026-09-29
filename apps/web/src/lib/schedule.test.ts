import { describe, expect, it } from "vitest";
import {
  addDays,
  asSecondPerson,
  cellId,
  dayOfWeek,
  formatWeekRange,
  parseCellId,
  shiftRange,
  shortTime,
  timeOffOn,
  type WeekEmployee,
} from "./schedule";

describe("schedule helpers", () => {
  it("does calendar math on local dates without time-zone drift", () => {
    expect(addDays("2026-09-28", 6)).toBe("2026-10-04");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(dayOfWeek("2026-09-28")).toBe(1); // Monday
  });

  it("formats compact shift times, including past midnight", () => {
    expect(shortTime(17 * 60)).toBe("5p");
    expect(shortTime(17 * 60 + 30)).toBe("5:30p");
    expect(shortTime(0)).toBe("12a");
    expect(shiftRange({ startMinute: 1020, endMinute: 1500 })).toBe("5p – 1a");
  });

  it("formats week ranges within and across months", () => {
    const week = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
    expect(formatWeekRange(week("2026-09-14"))).toBe("Sep 14 – 20, 2026");
    expect(formatWeekRange(week("2026-09-28"))).toBe("Sep 28 – Oct 4, 2026");
  });

  it("round-trips drop-target ids for people and open shifts", () => {
    expect(parseCellId(cellId("emp_1", "2026-09-28"))).toEqual({
      employeeId: "emp_1",
      date: "2026-09-28",
    });
    expect(parseCellId(cellId(null, "2026-09-28")).employeeId).toBeNull();
  });

  it("rewrites rules-engine messages for the employee reading them", () => {
    expect(asSecondPerson("Maya is already working Fri 5pm–1am")).toBe(
      "You're already working Fri 5pm–1am",
    );
    expect(asSecondPerson("Maya isn't trained as Bartender")).toBe(
      "You aren't trained as Bartender",
    );
    expect(asSecondPerson("Maya has approved time off")).toBe("You have approved time off");
    expect(asSecondPerson("Only 6h rest between shifts")).toBe("Only 6h rest between shifts");
  });

  it("prefers approved time off over a pending request on the same day", () => {
    const employee = {
      timeOff: [
        { id: "a", type: "VACATION", status: "PENDING", startDate: "2026-09-28", endDate: "2026-10-02" },
        { id: "b", type: "SICK", status: "APPROVED", startDate: "2026-09-30", endDate: "2026-09-30" },
      ],
    } as WeekEmployee;
    expect(timeOffOn(employee, "2026-09-29")?.id).toBe("a");
    expect(timeOffOn(employee, "2026-09-30")?.id).toBe("b");
    expect(timeOffOn(employee, "2026-10-03")).toBeUndefined();
  });
});
