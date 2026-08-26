import { describe, it, expect } from "vitest";
import {
  COLLECTION_REQUEST_STATUSES,
  getBloodbankCollectionRequestStatusLabel,
  getCollectionRequestStatusColor,
  getCollectionRequestStatusLabel,
} from "~/utils/collectionRequestStatus";

describe("COLLECTION_REQUEST_STATUSES", () => {
  it("covers the 9 canonical statuses from the server model", () => {
    expect(COLLECTION_REQUEST_STATUSES).toEqual([
      "pending",
      "accepted",
      "rejected",
      "cancelled",
      "counter_proposed",
      "counter_proposal_declined",
      "awaiting_technical_visit",
      "technical_visit_confirmed",
      "scheduled",
    ]);
  });
});

describe("getCollectionRequestStatusLabel", () => {
  it("maps every status to a non-empty PT-BR label", () => {
    for (const status of COLLECTION_REQUEST_STATUSES) {
      const label = getCollectionRequestStatusLabel(status);
      expect(label, `status "${status}" must not leak the raw enum`).not.toBe(
        status
      );
      expect(label, `status "${status}" must have a label`).not.toBe("");
      // PT-BR sanity: no underscores, no lowercase-only english enums.
      expect(label).not.toMatch(/_/);
    }
  });

  it("matches the institution-side wording for each status", () => {
    expect(getCollectionRequestStatusLabel("pending")).toBe("Pendente");
    expect(getCollectionRequestStatusLabel("accepted")).toBe("Aceita");
    expect(getCollectionRequestStatusLabel("rejected")).toBe("Rejeitada");
    expect(getCollectionRequestStatusLabel("cancelled")).toBe("Cancelada");
    expect(getCollectionRequestStatusLabel("counter_proposed")).toBe(
      "Contraproposta Recebida"
    );
    expect(getCollectionRequestStatusLabel("counter_proposal_declined")).toBe(
      "Contraproposta Recusada"
    );
    expect(getCollectionRequestStatusLabel("awaiting_technical_visit")).toBe(
      "Aguardando visita técnica"
    );
    expect(
      getCollectionRequestStatusLabel("technical_visit_confirmed")
    ).toBe("Visita técnica confirmada");
    expect(getCollectionRequestStatusLabel("scheduled")).toBe(
      "Solicitação agendada"
    );
  });

  it("returns empty string for unknown status (no raw enum leak)", () => {
    expect(getCollectionRequestStatusLabel("some_new_status")).toBe("");
  });
});

describe("getCollectionRequestStatusColor", () => {
  it("matches the institution-side color for each status", () => {
    expect(getCollectionRequestStatusColor("pending")).toBe("warning");
    expect(getCollectionRequestStatusColor("accepted")).toBe("success");
    expect(getCollectionRequestStatusColor("rejected")).toBe("error");
    expect(getCollectionRequestStatusColor("cancelled")).toBe("neutral");
    expect(getCollectionRequestStatusColor("counter_proposed")).toBe("info");
    expect(getCollectionRequestStatusColor("counter_proposal_declined")).toBe(
      "error"
    );
    expect(getCollectionRequestStatusColor("awaiting_technical_visit")).toBe(
      "warning"
    );
    expect(
      getCollectionRequestStatusColor("technical_visit_confirmed")
    ).toBe("success");
    expect(getCollectionRequestStatusColor("scheduled")).toBe("success");
  });

  it("returns neutral for unknown status", () => {
    expect(getCollectionRequestStatusColor("some_new_status")).toBe("neutral");
  });
});

describe("getBloodbankCollectionRequestStatusLabel", () => {
  it("descreve counter_proposed como uma contraproposta enviada pelo banco", () => {
    expect(getBloodbankCollectionRequestStatusLabel("counter_proposed")).toBe(
      "Contraproposta enviada"
    );
  });

  it("preserva o rótulo público da instituição para os demais status", () => {
    expect(getBloodbankCollectionRequestStatusLabel("pending")).toBe(
      "Pendente"
    );
    expect(getBloodbankCollectionRequestStatusLabel("accepted")).toBe("Aceita");
  });
});
