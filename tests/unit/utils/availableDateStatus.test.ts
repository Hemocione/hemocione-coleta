import { describe, it, expect } from "vitest";
import {
  getCalendarAvailabilityColor,
  isAvailableDateFullyBooked,
} from "~/utils/availableDateStatus";

describe("getCalendarAvailabilityColor", () => {
  it("returns undefined when there is no available date record", () => {
    expect(getCalendarAvailabilityColor(null)).toBeUndefined();
    expect(getCalendarAvailabilityColor(undefined)).toBeUndefined();
  });

  it("returns neutral for a blocked date, regardless of slots", () => {
    expect(
      getCalendarAvailabilityColor({ status: "blocked", slots: [] })
    ).toBe("neutral");
  });

  it("returns info for a pending date, regardless of slots", () => {
    expect(
      getCalendarAvailabilityColor({ status: "pending", slots: [] })
    ).toBe("info");
  });

  it("returns undefined for a released date with no slots", () => {
    expect(
      getCalendarAvailabilityColor({ status: "released", slots: [] })
    ).toBeUndefined();
  });

  it("treats a missing status as released (legacy records)", () => {
    expect(
      getCalendarAvailabilityColor({
        slots: [{ locked: false }, { locked: false }],
      })
    ).toBe("success");
  });

  it("returns success when a released date has no locked slots", () => {
    expect(
      getCalendarAvailabilityColor({
        status: "released",
        slots: [{ locked: false }, { lockedBy: null }],
      })
    ).toBe("success");
  });

  it("returns warning when a released date has some locked slots", () => {
    expect(
      getCalendarAvailabilityColor({
        status: "released",
        slots: [{ locked: true }, { locked: false }],
      })
    ).toBe("warning");
  });

  it("returns error when every slot of a released date is locked", () => {
    expect(
      getCalendarAvailabilityColor({
        status: "released",
        slots: [{ locked: true }, { lockedBy: "collection-request-a" }],
      })
    ).toBe("error");
  });
});

describe("isAvailableDateFullyBooked", () => {
  it("retorna true quando todos os slots estão locked", () => {
    expect(
      isAvailableDateFullyBooked({
        slots: [{ locked: true }, { locked: false, lockedBy: "req-a" }],
      })
    ).toBe(true);
  });

  it("retorna false quando pelo menos um slot está livre", () => {
    expect(
      isAvailableDateFullyBooked({
        slots: [{ locked: true }, { locked: false }],
      })
    ).toBe(false);
  });

  it("retorna false quando não há slots (isAllTeams ainda não configurado)", () => {
    expect(isAvailableDateFullyBooked({ slots: [] })).toBe(false);
  });

  it("retorna false para null/undefined", () => {
    expect(isAvailableDateFullyBooked(null)).toBe(false);
    expect(isAvailableDateFullyBooked(undefined)).toBe(false);
  });
});
