import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  rejectCollectionRequest,
} from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  collectionRequestFindOneAndUpdate: vi.fn(),
  availableDateFind: vi.fn(),
  notifyCollectionRequestStatusTransition: vi.fn(),
  getInstitutionsByIds: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.collectionRequestFindOneAndUpdate(...args),
    },
  },
  bloodBank: {
    BloodBank: {},
  },
  availableDate: {
    AvailableDate: {
      find: (...args: unknown[]) => mocks.availableDateFind(...args),
    },
  },
  team: { Team: {} },
  technicalVisit: { TechnicalVisit: {} },
  commitmentTerm: { CommitmentTerm: {} },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: (...args: unknown[]) =>
    mocks.getInstitutionsByIds(...args),
}));

vi.mock("~/server/services/collectionRequestNotification", () => ({
  notifyCollectionRequestStatusTransition: (...args: unknown[]) =>
    mocks.notifyCollectionRequestStatusTransition(...args),
}));

const REJECTABLE_STATUSES = [
  "pending",
  "accepted",
  "counter_proposed",
  "counter_proposal_declined",
  "awaiting_technical_visit",
  "technical_visit_confirmed",
];

const NON_REJECTABLE_STATUSES = ["rejected", "cancelled", "scheduled"];

// Documento mínimo que satisfaz getCollectionRequestById sem estourar.
const detailedRequest = (overrides: Record<string, unknown> = {}) => ({
  _id: "request-a",
  status: "rejected",
  institutionId: "institution-a",
  bloodBanksLocationId: "blood-bank-a",
  deletedAt: null,
  requestedDates: [],
  ...overrides,
});

function stubGetCollectionRequestById(finalDoc: Record<string, unknown>) {
  mocks.collectionRequestFindOne.mockImplementation(() => {
    // Primeira chamada: pré-leitura do status no reject (status rejeitável).
    // Chamadas seguintes (getCollectionRequestById): devolve o doc final.
    const calls = mocks.collectionRequestFindOne.mock.calls.length;
    if (calls === 1)
      return {
        lean: async () =>
          detailedRequest({ status: "counter_proposed" }),
      };
    return { lean: async () => finalDoc };
  });
  mocks.collectionRequestFindOneAndUpdate.mockReturnValue({
    lean: async () => ({}),
  });
  mocks.getInstitutionsByIds.mockResolvedValue([
    { name: "Instituição A" },
  ]);
  mocks.availableDateFind.mockReturnValue({
    populate: () => ({
      lean: async () => [],
    }),
  });
}

beforeEach(() => {
  mocks.collectionRequestFindOne.mockReset();
  mocks.collectionRequestFindOneAndUpdate.mockReset();
  mocks.availableDateFind.mockReset();
  mocks.notifyCollectionRequestStatusTransition.mockReset();
  mocks.getInstitutionsByIds.mockReset();
});

describe("rejectCollectionRequest — transições de status em aberto", () => {
  it.each(REJECTABLE_STATUSES)(
    "rejeita solicitação com status %s (antes só pending era rejeitável)",
    async (status) => {
      stubGetCollectionRequestById(detailedRequest());

      await rejectCollectionRequest(
        "request-a",
        "Motivo da recusa",
        "bloodbank-user",
        "blood-bank-a"
      );

      // Pré-leitura do documento atual
      expect(mocks.collectionRequestFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "request-a",
          bloodBanksLocationId: "blood-bank-a",
          deletedAt: null,
        })
      );

      // Mutação casando com todos os status rejeitáveis
      const [query, update] =
        mocks.collectionRequestFindOneAndUpdate.mock.calls[0];
      expect(query).toEqual({
        _id: "request-a",
        status: { $in: REJECTABLE_STATUSES },
        deletedAt: null,
        bloodBanksLocationId: "blood-bank-a",
      });
      expect(update.$set).toMatchObject({
        status: "rejected",
        rejectionReason: "Motivo da recusa",
      });
      expect(update.$push.statusHistory).toMatchObject({
        status: "rejected",
        changedBy: "bloodbank-user",
        reason: "Motivo da recusa",
      });
      void status;
    }
  );

  it.each(NON_REJECTABLE_STATUSES)(
    "NÃO muta e retorna 409 quando o status é %s",
    async (status) => {
      mocks.collectionRequestFindOne.mockReturnValue({
        lean: async () => detailedRequest({ status }),
      });

      const promise = rejectCollectionRequest(
        "request-a",
        "Motivo da recusa",
        "bloodbank-user",
        "blood-bank-a"
      );

      await expect(promise).rejects.toMatchObject({
        statusCode: 409,
      });
      await expect(
        rejectCollectionRequest(
          "request-a",
          "Motivo da recusa",
          "bloodbank-user",
          "blood-bank-a"
        )
      ).rejects.toThrow(/cannot be rejected/i);

      // Nenhuma mutação pode acontecer para status terminal/agendado
      expect(mocks.collectionRequestFindOneAndUpdate).not.toHaveBeenCalled();
    }
  );

  it("retorna null quando a solicitação não existe (endpoint responde 404)", async () => {
    mocks.collectionRequestFindOne.mockReturnValue({
      lean: async () => null,
    });

    const result = await rejectCollectionRequest(
      "request-inexistente",
      "Motivo da recusa",
      "bloodbank-user",
      "blood-bank-a"
    );

    expect(result).toBeNull();
    expect(mocks.collectionRequestFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("propaga o documento atualizado com detalhes após rejeitar", async () => {
    const updated = detailedRequest();
    stubGetCollectionRequestById(updated);

    const result = await rejectCollectionRequest(
      "request-a",
      "Motivo da recusa",
      "bloodbank-user",
      "blood-bank-a"
    );

    expect(result).toMatchObject({ _id: "request-a", status: "rejected" });
    expect(result).toHaveProperty("availableSlotOptions");
  });
});
