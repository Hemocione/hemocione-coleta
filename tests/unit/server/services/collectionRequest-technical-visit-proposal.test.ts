import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionRequestSchema } from "~/server/models/collectionRequest";
import {
  proposeTechnicalVisit,
  respondToTechnicalVisitProposal,
} from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  collectionRequestFindOneAndUpdate: vi.fn(),
  createTechnicalVisit: vi.fn(),
  getTechnicalVisitById: vi.fn(),
  notifyCollectionRequestStatusTransition: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.collectionRequestFindOneAndUpdate(...args),
    },
  },
  bloodBank: { BloodBank: {} },
  availableDate: { AvailableDate: {} },
  team: { Team: {} },
  technicalVisit: { TechnicalVisit: {} },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: vi.fn(),
}));

vi.mock("~/server/services/technicalVisit", () => ({
  createTechnicalVisit: (...args: unknown[]) =>
    mocks.createTechnicalVisit(...args),
  getTechnicalVisitById: (...args: unknown[]) =>
    mocks.getTechnicalVisitById(...args),
}));

vi.mock("~/server/services/collectionRequestNotification", () => ({
  notifyCollectionRequestStatusTransition: (...args: unknown[]) =>
    mocks.notifyCollectionRequestStatusTransition(...args),
}));

const requestId = "request-a";
const bloodBanksLocationId = "blood-bank-a";
const bankUserId = "blood-bank-user";
const institutionUserId = "institution-user";

const proposedDates = [
  {
    date: new Date("2026-09-10T00:00:00.000Z"),
    startTime: "08:30",
    durationMinutes: 45,
    note: "Primeira opção",
  },
  {
    date: new Date("2026-09-11T00:00:00.000Z"),
    startTime: "14:00",
    durationMinutes: 60,
    note: "Segunda opção",
  },
];

const visitProposal = {
  proposedDates,
  note: "Precisamos validar o espaço antes do evento",
  proposedBy: bankUserId,
  proposedAt: new Date("2026-08-20T00:00:00.000Z"),
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("proposeTechnicalVisit", () => {
  it("propõe datas para a visita mantendo o status awaiting_technical_visit", async () => {
    const updatedRequest = {
      _id: requestId,
      status: "awaiting_technical_visit",
      bloodBanksLocationId,
    };
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(updatedRequest);

    await expect(
      proposeTechnicalVisit(
        requestId,
        {
          proposedDates,
          note: visitProposal.note,
          proposedBy: bankUserId,
        },
        bloodBanksLocationId
      )
    ).resolves.toEqual(updatedRequest);

    const [query, update, options] =
      mocks.collectionRequestFindOneAndUpdate.mock.calls[0];
    expect(query).toEqual({
      _id: requestId,
      bloodBanksLocationId,
      status: "awaiting_technical_visit",
      deletedAt: null,
      visitProposal: { $exists: false },
      technicalVisitId: { $exists: false },
    });
    expect(update.$set.visitProposal).toMatchObject({
      proposedDates,
      note: visitProposal.note,
      proposedBy: bankUserId,
    });
    expect(update.$set.visitProposal.proposedAt).toBeInstanceOf(Date);
    expect(update.$push.statusHistory).toMatchObject({
      status: "awaiting_technical_visit",
      changedBy: bankUserId,
    });
    expect(options).toEqual({ new: true });
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId,
      bloodBanksLocationId,
      transition: "technical_visit_proposed",
    });
  });

  it("rejeita quando já existe uma proposta de visita ativa ou visita já agendada", async () => {
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      proposeTechnicalVisit(
        requestId,
        { proposedDates, note: "Outra proposta", proposedBy: bankUserId },
        bloodBanksLocationId
      )
    ).rejects.toThrow();

    expect(mocks.notifyCollectionRequestStatusTransition).not.toHaveBeenCalled();
  });

  it("rejeita (IDOR) quando a solicitação pertence a outro banco de sangue", async () => {
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      proposeTechnicalVisit(
        "request-do-banco-b",
        { proposedDates, note: "Tentativa cross-bank", proposedBy: bankUserId },
        bloodBanksLocationId
      )
    ).rejects.toThrow();

    expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "request-do-banco-b",
        bloodBanksLocationId,
      }),
      expect.anything(),
      { new: true }
    );
  });

  it.each(["pending", "accepted", "counter_proposed", "technical_visit_confirmed", "scheduled"])(
    "rejeita se o status atual for %s",
    async (status) => {
      mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(null);

      await expect(
        proposeTechnicalVisit(
          requestId,
          { proposedDates, note: "Outra proposta", proposedBy: bankUserId },
          bloodBanksLocationId
        )
      ).rejects.toThrow();

      expect(mocks.collectionRequestFindOneAndUpdate.mock.calls[0][0]).toEqual(
        expect.objectContaining({ status: "awaiting_technical_visit" })
      );
      expect(status).not.toBe("awaiting_technical_visit");
    }
  );
});

describe("respondToTechnicalVisitProposal", () => {
  it("aceita a data proposta, cria a visita técnica e notifica o banco", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue({
      _id: requestId,
      status: "awaiting_technical_visit",
      bloodBanksLocationId,
      institutionId: "institution-a",
      address: {
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01000000",
      },
      visitProposal,
    });
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValueOnce({
      _id: requestId,
      status: "awaiting_technical_visit",
    });
    mocks.createTechnicalVisit.mockResolvedValue({ _id: "visit-new" });
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValueOnce({
      _id: requestId,
      status: "awaiting_technical_visit",
      technicalVisitId: "visit-new",
    });

    await respondToTechnicalVisitProposal(requestId, {
      decision: "accepted",
      selectedDateId: "1",
      respondedBy: institutionUserId,
    });

    // 1st write: resolve the proposal atomically
    const [resolveQuery, resolveUpdate] =
      mocks.collectionRequestFindOneAndUpdate.mock.calls[0];
    expect(resolveQuery).toEqual({
      _id: requestId,
      status: "awaiting_technical_visit",
      deletedAt: null,
      visitProposal: { $exists: true },
    });
    expect(resolveUpdate.$push.previousVisitProposals).toMatchObject({
      ...visitProposal,
      response: {
        decision: "accepted",
        selectedDateId: "1",
        respondedBy: institutionUserId,
      },
    });
    expect(resolveUpdate.$unset).toEqual({ visitProposal: 1 });

    // Technical visit created from the selected proposed date (index 1).
    // "14:00" é hora local do banco (America/Sao_Paulo) → 17:00Z em UTC.
    expect(mocks.createTechnicalVisit).toHaveBeenCalledWith({
      bloodBanksLocationId,
      institutionId: "institution-a",
      address: "Rua A, 10, Centro, São Paulo - SP, 01000000",
      visitDate: new Date("2026-09-11T17:00:00.000Z"),
      outcome: "pending",
      notes: "Segunda opção",
      visitedBy: bankUserId,
    });

    // 2nd write: link visit to request (via linkTechnicalVisitToRequest)
    const [linkQuery, linkUpdate] =
      mocks.collectionRequestFindOneAndUpdate.mock.calls[1];
    expect(linkQuery).toEqual({
      _id: requestId,
      bloodBanksLocationId,
      status: "awaiting_technical_visit",
      deletedAt: null,
    });
    expect(linkUpdate.$set).toEqual({
      technicalVisitId: "visit-new",
      status: "awaiting_technical_visit",
    });

    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId,
      bloodBanksLocationId,
      transition: "technical_visit_scheduled",
      recipientUserId: bankUserId,
    });
  });

  it("interpreta o horário proposto como hora local de America/Sao_Paulo", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue({
      _id: requestId,
      status: "awaiting_technical_visit",
      bloodBanksLocationId,
      institutionId: "institution-a",
      address: {
        street: "Rua A",
        number: "10",
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zipCode: "01000000",
      },
      visitProposal: {
        ...visitProposal,
        proposedDates: [
          {
            // Meia-noite UTC do dia local (padrão do z.coerce.date())
            date: new Date("2026-09-30T00:00:00.000Z"),
            startTime: "14:00",
            durationMinutes: 60,
            note: "",
          },
        ],
      },
    });
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue({
      _id: requestId,
      status: "awaiting_technical_visit",
    });
    mocks.createTechnicalVisit.mockResolvedValue({ _id: "visit-new" });

    await respondToTechnicalVisitProposal(requestId, {
      decision: "accepted",
      selectedDateId: "0",
      respondedBy: institutionUserId,
    });

    // 14:00 BRT (UTC-3) → 17:00Z; proposta e card exibem o mesmo horário.
    expect(mocks.createTechnicalVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        visitDate: new Date("2026-09-30T17:00:00.000Z"),
      })
    );
  });

  it("rejeita quando a data selecionada não existe na proposta", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue({
      _id: requestId,
      status: "awaiting_technical_visit",
      bloodBanksLocationId,
      institutionId: "institution-a",
      visitProposal,
    });

    await expect(
      respondToTechnicalVisitProposal(requestId, {
        decision: "accepted",
        selectedDateId: "9",
        respondedBy: institutionUserId,
      })
    ).rejects.toThrow("not in the technical visit proposal");

    expect(mocks.collectionRequestFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.createTechnicalVisit).not.toHaveBeenCalled();
  });

  it("recusa a proposta e notifica o banco sem criar visita técnica", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue({
      _id: requestId,
      status: "awaiting_technical_visit",
      bloodBanksLocationId,
      institutionId: "institution-a",
      visitProposal,
    });
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue({
      _id: requestId,
      status: "awaiting_technical_visit",
    });

    await respondToTechnicalVisitProposal(requestId, {
      decision: "declined",
      selectedDateId: "",
      respondedBy: institutionUserId,
    });

    expect(mocks.createTechnicalVisit).not.toHaveBeenCalled();
    expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledOnce();
    const update = mocks.collectionRequestFindOneAndUpdate.mock.calls[0][1];
    expect(update.$push.previousVisitProposals).toMatchObject({
      ...visitProposal,
      response: {
        decision: "declined",
        selectedDateId: "",
        respondedBy: institutionUserId,
      },
    });
    expect(update.$unset).toEqual({ visitProposal: 1 });
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId,
      bloodBanksLocationId,
      transition: "technical_visit_proposal_declined",
      recipientUserId: bankUserId,
    });
  });

  it("rejeita dupla resposta (proposta já resolvida)", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue(null);

    await expect(
      respondToTechnicalVisitProposal(requestId, {
        decision: "declined",
        selectedDateId: "",
        respondedBy: institutionUserId,
      })
    ).rejects.toThrow();

    expect(mocks.collectionRequestFindOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("schema de CollectionRequest - visitProposal", () => {
  it("expõe os campos da proposta de visita técnica", () => {
    expect(CollectionRequestSchema.path("visitProposal")).toBeDefined();
    expect(
      CollectionRequestSchema.path("previousVisitProposals")
    ).toBeDefined();
  });
});
