import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTechnicalVisitsByBloodBank,
  linkTechnicalVisitToCollectionRequest,
} from "~/server/services/technicalVisit";

const mocks = vi.hoisted(() => ({
  technicalVisitCountDocuments: vi.fn(),
  technicalVisitFind: vi.fn(),
  collectionRequestFind: vi.fn(),
  collectionRequestFindOneAndUpdate: vi.fn(),
  getInstitutionsByIds: vi.fn(),
}));

function chainable<T>(value: T) {
  const query = Promise.resolve(value) as Promise<T> & {
    lean: () => Promise<T>;
    sort: () => typeof query;
    skip: () => typeof query;
    limit: () => typeof query;
  };
  query.lean = () => Promise.resolve(value);
  query.sort = () => query;
  query.skip = () => query;
  query.limit = () => query;
  return query;
}

vi.mock("~/server/models", () => ({
  technicalVisit: {
    TechnicalVisit: {
      countDocuments: (...args: unknown[]) =>
        mocks.technicalVisitCountDocuments(...args),
      find: (...args: unknown[]) => mocks.technicalVisitFind(...args),
    },
  },
  collectionRequest: {
    CollectionRequest: {
      find: (...args: unknown[]) => mocks.collectionRequestFind(...args),
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.collectionRequestFindOneAndUpdate(...args),
    },
  },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: (...args: unknown[]) => mocks.getInstitutionsByIds(...args),
}));

vi.mock("~/server/services/collectionRequestNotification", () => ({
  notifyCollectionRequestStatusTransition: vi.fn(),
}));

const bloodBanksLocationId = "blood-bank-a";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.technicalVisitCountDocuments.mockResolvedValue(1);
  mocks.technicalVisitFind.mockReturnValue(
    chainable([
      {
        _id: "visit-a",
        bloodBanksLocationId,
        institutionId: "institution-a",
        address: "Rua A, 1",
        visitDate: new Date("2026-09-10T12:00:00.000Z"),
        outcome: "pending",
        visitedBy: "user-a",
      },
    ])
  );
  mocks.collectionRequestFind.mockReturnValue(
    chainable([
      {
        _id: "request-a",
        technicalVisitId: "visit-a",
        institutionId: "institution-a",
        status: "scheduled",
        eventSlug: "campanha-a",
      },
    ])
  );
  mocks.getInstitutionsByIds.mockResolvedValue([
    { id: "institution-a", name: "Instituição A", address: "Rua Instituição, 10" },
  ]);
  mocks.collectionRequestFindOneAndUpdate.mockResolvedValue({
    _id: "request-a",
    technicalVisitId: "visit-a",
  });
});

describe("detalhes de visitas técnicas", () => {
  it("retorna instituição, solicitação e evento vinculados na lista do banco", async () => {
    const result = await getTechnicalVisitsByBloodBank(bloodBanksLocationId);

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        institutionId: "institution-a",
        institutionName: "Instituição A",
        institutionAddress: "Rua Instituição, 10",
        collectionRequest: {
          _id: "request-a",
          institutionId: "institution-a",
          status: "scheduled",
          eventSlug: "campanha-a",
        },
      })
    );
    expect(mocks.collectionRequestFind).toHaveBeenCalledWith({
      technicalVisitId: { $in: ["visit-a"] },
      bloodBanksLocationId,
      deletedAt: null,
    });
  });

  it("vincula uma visita nova à solicitação aguardando visita sem alterar o status", async () => {
    await linkTechnicalVisitToCollectionRequest(
      "request-a",
      bloodBanksLocationId,
      "visit-a"
    );

    expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: "request-a",
        bloodBanksLocationId,
        status: "awaiting_technical_visit",
        technicalVisitId: { $exists: false },
        deletedAt: null,
      },
      { $set: { technicalVisitId: "visit-a" } },
      { new: true }
    );
  });
});
