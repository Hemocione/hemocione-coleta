export type AvailableDateStatus = "blocked" | "pending" | "released";

export interface AvailableDateSlotLike {
  locked?: boolean;
  lockedBy?: string | null;
}

export interface AvailableDateLike {
  status?: AvailableDateStatus;
  slots: AvailableDateSlotLike[];
}

export type CalendarAvailabilityColor =
  | "success"
  | "warning"
  | "error"
  | "neutral"
  | "info"
  | undefined;

// Registros antigos não tem o campo status; ausência equivale a "released".
export function getCalendarAvailabilityColor(
  availableDate: AvailableDateLike | null | undefined
): CalendarAvailabilityColor {
  if (!availableDate) return undefined;

  const status = availableDate.status ?? "released";

  if (status === "blocked") return "neutral";
  if (status === "pending") return "info";

  if (!availableDate.slots.length) return undefined;

  const isSlotLocked = (slot: AvailableDateSlotLike) =>
    Boolean(slot.locked || slot.lockedBy);

  if (availableDate.slots.every(isSlotLocked)) return "error";
  if (availableDate.slots.some(isSlotLocked)) return "warning";
  return "success";
}
