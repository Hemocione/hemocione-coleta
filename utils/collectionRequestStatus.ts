// Mapa compartilhado de status de solicitação de coleta.
// Espelha os rótulos/cores de pages/agendar/acompanhar/[token]/index.vue
// (lado da instituição) para manter consistência entre as telas.
// Fonte dos valores: server/models/collectionRequest.ts (COLLECTION_REQUEST_STATUSES).

export const COLLECTION_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "counter_proposed",
  "counter_proposal_declined",
  "awaiting_technical_visit",
  "technical_visit_confirmed",
  "scheduled",
] as const;

export type CollectionRequestStatus = (typeof COLLECTION_REQUEST_STATUSES)[number];

type UBadgeColor =
  | "primary"
  | "secondary"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "neutral";

const STATUS_LABELS: Record<CollectionRequestStatus, string> = {
  pending: "Pendente",
  accepted: "Aceita",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
  counter_proposed: "Contraproposta Recebida",
  counter_proposal_declined: "Contraproposta Recusada",
  awaiting_technical_visit: "Aguardando visita técnica",
  technical_visit_confirmed: "Visita técnica confirmada",
  scheduled: "Solicitação agendada",
};

const STATUS_COLORS: Record<CollectionRequestStatus, UBadgeColor> = {
  pending: "warning",
  accepted: "success",
  rejected: "error",
  cancelled: "neutral",
  counter_proposed: "info",
  counter_proposal_declined: "error",
  awaiting_technical_visit: "warning",
  technical_visit_confirmed: "success",
  scheduled: "success",
};

export function getCollectionRequestStatusLabel(
  status: string | null | undefined
): string {
  if (!status) return "";
  return STATUS_LABELS[status as CollectionRequestStatus] ?? "";
}

export function getBloodbankCollectionRequestStatusLabel(
  status: string | null | undefined
): string {
  if (status === "counter_proposed") return "Contraproposta enviada";
  return getCollectionRequestStatusLabel(status);
}

export function getCollectionRequestStatusColor(
  status: string | null | undefined
): UBadgeColor {
  if (!status) return "neutral";
  return STATUS_COLORS[status as CollectionRequestStatus] ?? "neutral";
}
