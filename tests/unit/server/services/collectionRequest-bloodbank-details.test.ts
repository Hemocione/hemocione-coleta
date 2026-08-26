import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollectionRequestsByInstitution } from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestCountDocuments: vi.fn(),
  collectionRequestFind: vi.fn(),
  bloodBankFind: vi.fn(),
  availableDateFind: vi.fn(),
  getInstitutionsByIds: vi.fn(),
}));

// Retorna um valor "chainable" que também é diretamente awaitable — imita o
// comportamento de uma Query do mongoose, que pode ser aguardada direto ou
// encadeada com .lean()/.populate()/.sort()/etc antes de ser aguardada.
function chainable<T>(result: T) {
  const promise = Promise.resolve(result) as Promise<T> & {
    lean: () => Promise<T>;
    populate: () => Promise<T>;
    sort: () => Promise<T>;
    skip: () => Promise<T>;
    limit: () => Promise<T>;
  };
  promise.lean = () => Promise.resolve(result);
  promise.populate = () => chainable(result);
  promise.sort = () => chainable(result);
  promise.skip = () => chainable(result);
  promise.limit = () => chainable(result);
  return promise;
}

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      countDocuments: (...args: unknown[]) =>
        mocks.collectionRequestCountDocuments(...args),
      find: (...args: unknown[]) => mocks.collectionRequestFind(...args),
    },
  },
  bloodBank: {
    BloodBank: {
      find: (...args: unknown[]) => mocks.bloodBankFind(...args),
    },
  },
  availableDate: {
    AvailableDate: {
      find: (...args: unknown[]) => mocks.availableDateFind(...args),
    },
  },
  team: { Team: {} },
  technicalVisit: { TechnicalVisit: {} },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: (...args: unknown[]) =>
    mocks.getInstitutionsByIds(...args),
}));

vi.mock("~/server/services/technicalVisit", () => ({
  createTechnicalVisit: vi.fn(),
  getTechnicalVisitById: vi.fn(),
}));

vi.mock("~/server/services/collectionRequestNotification", () => ({
  notifyCollectionRequestStatusTransition: vi.fn(),
}));

const baseHost = {
  name: "Pessoa responsável",
  email: "pessoa@example.com",
  phone: "11999999999",
};

beforeEach(() => {
  mocks.collectionRequestCountDocuments.mockReset();
  mocks.collectionRequestFind.mockReset();
  mocks.bloodBankFind.mockReset();
  mocks.availableDateFind.mockReset();
  mocks.getInstitutionsByIds.mockReset();

  mocks.availableDateFind.mockReturnValue(chainable([]));
  mocks.getInstitutionsByIds.mockResolvedValue([
    { id: "institution-a", name: "Instituição A" },
  ]);
});

describe("getCollectionRequestsByInstitution — dados do banco de sangue", () => {
  it("inclui bloodBankName e bloodBankLogo resolvidos em lote por bloodBanksLocationId", async () => {
    mocks.collectionRequestCountDocuments.mockResolvedValue(2);
    mocks.collectionRequestFind.mockReturnValue(
      chainable([
        {
          _id: "request-a",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-a",
          requestedDates: [],
          host: baseHost,
          status: "pending",
          statusHistory: [],
        },
        {
          _id: "request-b",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-b",
          requestedDates: [],
          host: baseHost,
          status: "accepted",
          statusHistory: [],
        },
      ])
    );
    mocks.bloodBankFind.mockReturnValue(
      chainable([
        {
          bloodBanksLocationId: "blood-bank-a",
          name: "Banco de Sangue A",
          logo: "https://example.com/a.png",
        },
        {
          bloodBanksLocationId: "blood-bank-b",
          name: "Banco de Sangue B",
          logo: null,
        },
      ])
    );

    const result = await getCollectionRequestsByInstitution("institution-a");

    expect(mocks.bloodBankFind).toHaveBeenCalledWith({
      bloodBanksLocationId: { $in: ["blood-bank-a", "blood-bank-b"] },
    });
    expect(result.data).toEqual([
      expect.objectContaining({
        _id: "request-a",
        bloodBankName: "Banco de Sangue A",
        bloodBankLogo: "https://example.com/a.png",
      }),
      expect.objectContaining({
        _id: "request-b",
        bloodBankName: "Banco de Sangue B",
        bloodBankLogo: null,
      }),
    ]);
  });

  it("usa um nome padrão quando o banco de sangue não é encontrado", async () => {
    mocks.collectionRequestCountDocuments.mockResolvedValue(1);
    mocks.collectionRequestFind.mockReturnValue(
      chainable([
        {
          _id: "request-a",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-inexistente",
          requestedDates: [],
          host: baseHost,
          status: "pending",
          statusHistory: [],
        },
      ])
    );
    mocks.bloodBankFind.mockReturnValue(chainable([]));

    const result = await getCollectionRequestsByInstitution("institution-a");

    expect(result.data[0]).toMatchObject({
      bloodBankName: "Banco de Sangue",
      bloodBankLogo: undefined,
    });
  });
});
