import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollectionRequest } from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  bloodBankFindOne: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
    },
  },
  bloodBank: {
    BloodBank: {
      findOne: (...args: unknown[]) => mocks.bloodBankFindOne(...args),
    },
  },
  availableDate: {
    AvailableDate: {},
  },
  team: { Team: {} },
  technicalVisit: { TechnicalVisit: {} },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: vi.fn(),
}));

const createData = {
  institutionId: "institution-a",
  requestedByUserId: "institution-user",
  requestedDates: [{ availableDateId: "available-date-a" }],
  host: {
    name: "Pessoa responsável",
    email: "pessoa@example.com",
    phone: "11999999999",
  },
};

beforeEach(() => {
  mocks.collectionRequestFindOne.mockReset();
  mocks.bloodBankFindOne.mockReset();
});

describe("createCollectionRequest — duplicidade responde 409 estruturado", () => {
  it("lança erro com statusCode 409 preservando a mensagem tratada pelo client", async () => {
    mocks.bloodBankFindOne.mockResolvedValue({ active: true });
    mocks.collectionRequestFindOne.mockResolvedValue({
      _id: "request-aberta",
      status: "pending",
    });

    const promise = createCollectionRequest("blood-bank-a", createData);

    // Client (pages/agendar/[bloodbankSlug]/index.vue) faz
    // errorMessage.includes("já possui uma solicitação em aberto").
    await expect(promise).rejects.toThrow(
      /já possui uma solicitação em aberto/
    );

    // Erro cru sem statusCode virava 500 [unhandled]; precisa ser 409.
    await expect(createCollectionRequest("blood-bank-a", createData)).rejects
      .toMatchObject({
        statusCode: 409,
        message: expect.stringContaining(
          "já possui uma solicitação em aberto"
        ),
      });
  });
});
