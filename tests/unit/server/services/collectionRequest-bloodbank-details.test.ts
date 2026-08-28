import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import {
  getCollectionRequestsByBloodBank,
  getCollectionRequestsByInstitution,
} from "~/server/services/collectionRequest";

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
  commitmentTerm: { CommitmentTerm: {} },
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

function uuidBinary(value: string) {
  return new mongoose.mongo.Binary(
    Buffer.from(value.replaceAll("-", ""), "hex"),
    4
  );
}

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
  it("resolve o banco quando lean retorna UUIDs como BSON Binary", async () => {
    const bloodBanksLocationId = "123e4567-e89b-12d3-a456-426614174000";

    mocks.collectionRequestCountDocuments.mockResolvedValue(1);
    mocks.collectionRequestFind.mockReturnValue(
      chainable([
        {
          _id: "request-a",
          institutionId: "institution-a",
          bloodBanksLocationId: uuidBinary(bloodBanksLocationId),
          requestedDates: [],
          host: baseHost,
          status: "pending",
          statusHistory: [],
        },
      ])
    );
    mocks.bloodBankFind.mockReturnValue(
      chainable([
        {
          bloodBanksLocationId: uuidBinary(bloodBanksLocationId),
          name: "Banco de Sangue A",
          logo: "https://example.com/a.png",
        },
      ])
    );

    const result = await getCollectionRequestsByInstitution("institution-a");

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        bloodBankName: "Banco de Sangue A",
        bloodBankLogo: "https://example.com/a.png",
      })
    );
  });

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

describe("getCollectionRequestsByBloodBank — filtros de status", () => {
  it("inclui pending e counter_proposed no mesmo resultado paginado", async () => {
    mocks.collectionRequestCountDocuments.mockResolvedValue(2);
    mocks.collectionRequestFind.mockReturnValue(
      chainable([
        {
          _id: "request-pending",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-a",
          requestedDates: [],
          host: baseHost,
          status: "pending",
          statusHistory: [],
        },
        {
          _id: "request-counter-proposed",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-a",
          requestedDates: [],
          host: baseHost,
          status: "counter_proposed",
          statusHistory: [],
        },
      ])
    );
    mocks.bloodBankFind.mockReturnValue(chainable([]));

    const result = await getCollectionRequestsByBloodBank(
      "blood-bank-a",
      { status: "pending,counter_proposed" },
      { page: 1, limit: 20 }
    );

    expect(result.data.map((request) => request.status)).toEqual([
      "pending",
      "counter_proposed",
    ]);
    expect(mocks.collectionRequestCountDocuments).toHaveBeenCalledWith({
      bloodBanksLocationId: "blood-bank-a",
      deletedAt: null,
      status: { $in: ["pending", "counter_proposed"] },
    });
    expect(mocks.collectionRequestFind).toHaveBeenCalledWith({
      bloodBanksLocationId: "blood-bank-a",
      deletedAt: null,
      status: { $in: ["pending", "counter_proposed"] },
    });
    expect(mocks.collectionRequestFind).toHaveBeenCalledTimes(1);
  });
});
