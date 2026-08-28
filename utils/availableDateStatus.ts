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

const isSlotLocked = (slot: AvailableDateSlotLike) =>
  Boolean(slot.locked || slot.lockedBy);

// Usado tanto pra colorir o calendário do banco quanto pra decidir se uma data
// deve sumir do calendário da instituição (ver getAvailableDatesByBloodBank).
export function isAvailableDateFullyBooked(
  availableDate: AvailableDateLike | null | undefined
): boolean {
  if (!availableDate || !availableDate.slots.length) return false;
  return availableDate.slots.every(isSlotLocked);
}

// Registros antigos não tem o campo status; ausência equivale a "released".
export function getCalendarAvailabilityColor(
  availableDate: AvailableDateLike | null | undefined
): CalendarAvailabilityColor {
  if (!availableDate) return undefined;

  const status = availableDate.status ?? "released";

  if (status === "blocked") return "neutral";
  if (status === "pending") return "info";

  if (!availableDate.slots.length) return undefined;

  if (isAvailableDateFullyBooked(availableDate)) return "error";
  if (availableDate.slots.some(isSlotLocked)) return "warning";
  return "success";
}
