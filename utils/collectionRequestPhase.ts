export interface CollectionRequestPhase {
  label: string;
  stepIndex: number;
  totalSteps: number;
  isTerminalNegative: boolean;
  statusLabel: string;
}

const PHASE_LABELS = ["Solicitado", "Aceito", "Visita Técnica", "Agendado"];

const STEP_INDEX_BY_STATUS: Record<string, number> = {
  pending: 0,
  counter_proposed: 0,
  counter_proposal_declined: 0,
  accepted: 1,
  awaiting_technical_visit: 2,
  technical_visit_confirmed: 2,
  scheduled: 3,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  counter_proposed: "Contraproposta Recebida",
  counter_proposal_declined: "Contraproposta Recusada",
  accepted: "Aceita",
  awaiting_technical_visit: "Aguardando Visita Técnica",
  technical_visit_confirmed: "Visita Técnica Confirmada",
  scheduled: "Agendada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

// Mapeia o status de uma solicitação de coleta para a fase exibida na
// bolinha de progresso da instituição. rejected/cancelled não avançam pelas
// fases: são estados terminais negativos, exibidos como badge à parte.
export function getCollectionRequestPhase(status: string): CollectionRequestPhase {
  const isTerminalNegative = status === "rejected" || status === "cancelled";
  const stepIndex = STEP_INDEX_BY_STATUS[status] ?? 0;

  return {
    label: PHASE_LABELS[stepIndex],
    stepIndex,
    totalSteps: PHASE_LABELS.length,
    isTerminalNegative,
    statusLabel: STATUS_LABELS[status] || status,
  };
}
