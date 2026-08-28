import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollectionRequestById } from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  availableDateFind: vi.fn(),
  getInstitutionsByIds: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
    },
  },
  availableDate: {
    AvailableDate: {
      find: (...args: unknown[]) => mocks.availableDateFind(...args),
    },
  },
  bloodBank: { BloodBank: {} },
  commitmentTerm: { CommitmentTerm: {} },
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

function queryWithLean<T>(value: T) {
  const query = {
    populate: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  query.populate.mockReturnValue(query);
  return query;
}

const requestId = "request-a";
const bloodBanksLocationId = "blood-bank-a";
const institutionUuid = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  mocks.collectionRequestFindOne.mockReset();
  mocks.availableDateFind.mockReset();
  mocks.getInstitutionsByIds.mockReset();
});

describe("getCollectionRequestById", () => {
  it("converte institutionId UUID Binary para texto antes da chamada externa", async () => {
    const institutionId = new mongoose.mongo.Binary(
      Buffer.from(institutionUuid.replaceAll("-", ""), "hex"),
      mongoose.mongo.Binary.SUBTYPE_UUID
    );
    const request = {
      _id: requestId,
      institutionId,
      bloodBanksLocationId,
      requestedDates: [],
    };

    mocks.collectionRequestFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(request),
    });
    mocks.availableDateFind.mockImplementation(() => queryWithLean([]));
    mocks.getInstitutionsByIds.mockResolvedValue([
      { id: institutionUuid, name: "Instituição A" },
    ]);

    await getCollectionRequestById(requestId, bloodBanksLocationId);

    expect(mocks.getInstitutionsByIds).toHaveBeenCalledWith([institutionUuid]);
  });
});
