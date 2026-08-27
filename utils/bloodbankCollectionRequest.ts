export interface SchedulableCollectionRequest {
  status: string;
  selectedSlotId?: string | null;
  confirmedSchedule?: unknown;
}

export function isCollectionRequestScheduled(
  request: SchedulableCollectionRequest
): boolean {
  return (
    ["accepted", "technical_visit_confirmed", "scheduled"].includes(
      request.status
    ) && Boolean(request.selectedSlotId || request.confirmedSchedule)
  );
}
