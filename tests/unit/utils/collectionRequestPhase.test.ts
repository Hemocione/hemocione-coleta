import { describe, it, expect } from "vitest";
import { getCollectionRequestPhase } from "~/utils/collectionRequestPhase";

describe("getCollectionRequestPhase", () => {
  it("coloca pending na fase 0 (Solicitado)", () => {
    const phase = getCollectionRequestPhase("pending");
    expect(phase.stepIndex).toBe(0);
    expect(phase.label).toBe("Solicitado");
    expect(phase.isTerminalNegative).toBe(false);
  });

  it("mantém counter_proposed e counter_proposal_declined na fase 0", () => {
    expect(getCollectionRequestPhase("counter_proposed").stepIndex).toBe(0);
    expect(
      getCollectionRequestPhase("counter_proposal_declined").stepIndex
    ).toBe(0);
  });

  it("coloca accepted na fase 1 (Aceito)", () => {
    const phase = getCollectionRequestPhase("accepted");
    expect(phase.stepIndex).toBe(1);
    expect(phase.label).toBe("Aceito");
  });

  it("agrupa awaiting_technical_visit e technical_visit_confirmed na fase 2 (Visita Técnica)", () => {
    expect(getCollectionRequestPhase("awaiting_technical_visit").stepIndex).toBe(2);
    expect(getCollectionRequestPhase("technical_visit_confirmed").stepIndex).toBe(2);
    expect(getCollectionRequestPhase("awaiting_technical_visit").label).toBe(
      "Visita Técnica"
    );
  });

  it("coloca scheduled na última fase (Agendado)", () => {
    const phase = getCollectionRequestPhase("scheduled");
    expect(phase.stepIndex).toBe(3);
    expect(phase.stepIndex).toBe(phase.totalSteps - 1);
    expect(phase.label).toBe("Agendado");
  });

  it("marca rejected e cancelled como fase terminal negativa", () => {
    expect(getCollectionRequestPhase("rejected").isTerminalNegative).toBe(true);
    expect(getCollectionRequestPhase("cancelled").isTerminalNegative).toBe(true);
  });

  it("não marca status não-terminais como terminal negativo", () => {
    expect(getCollectionRequestPhase("pending").isTerminalNegative).toBe(false);
    expect(getCollectionRequestPhase("accepted").isTerminalNegative).toBe(false);
    expect(getCollectionRequestPhase("scheduled").isTerminalNegative).toBe(false);
  });

  it("expõe um rótulo de status legível para cada status conhecido", () => {
    expect(getCollectionRequestPhase("pending").statusLabel).toBe("Pendente");
    expect(getCollectionRequestPhase("accepted").statusLabel).toBe("Aceita");
    expect(getCollectionRequestPhase("rejected").statusLabel).toBe("Rejeitada");
    expect(getCollectionRequestPhase("cancelled").statusLabel).toBe("Cancelada");
    expect(getCollectionRequestPhase("scheduled").statusLabel).toBe("Agendada");
  });

  it("usa o total de 4 fases para qualquer status não-terminal", () => {
    expect(getCollectionRequestPhase("pending").totalSteps).toBe(4);
    expect(getCollectionRequestPhase("scheduled").totalSteps).toBe(4);
  });

  it("cai de volta pro próprio status quando desconhecido, sem lançar erro", () => {
    const phase = getCollectionRequestPhase("status-desconhecido");
    expect(phase.statusLabel).toBe("status-desconhecido");
    expect(phase.stepIndex).toBe(0);
  });
});
