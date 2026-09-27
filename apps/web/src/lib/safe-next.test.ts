import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/schedule?week=2026-09-28")).toBe(
      "/schedule?week=2026-09-28",
    );
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
  ])("falls back for %s", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });
});
