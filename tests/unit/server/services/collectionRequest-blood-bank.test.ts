import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  CollectionRequest: {
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
  AvailableDate: {
    find: vi.fn(),
  },
  getInstitutionsByIds: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  team: { Team: {} },
  collectionRequest: { CollectionRequest: mocks.CollectionRequest },
  availableDate: { AvailableDate: mocks.AvailableDate },
  bloodBank: { BloodBank: {} },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: mocks.getInstitutionsByIds,
}));

const { getCollectionRequestsByBloodBank } = await import(
  "~/server/services/collectionRequest"
);

describe("getCollectionRequestsByBloodBank", () => {
  const institutionId = "123e4567-e89b-12d3-a456-426614174000";
  const requestedDateId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();

    const request = {
      institutionId: new mongoose.mongo.Binary(
        Buffer.from(institutionId.replaceAll("-", ""), "hex"),
        4
      ),
      requestedDates: [{ availableDateId: requestedDateId }],
    };

    mocks.CollectionRequest.countDocuments.mockResolvedValue(1);
    mocks.CollectionRequest.find.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([request]),
    });
    mocks.AvailableDate.find.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
    mocks.getInstitutionsByIds.mockResolvedValue([
      {
        id: institutionId,
        name: "Instituição teste",
        latitude: -22.9,
        longitude: -43.2,
        status: "validated",
      },
    ]);
  });

  it("retains requests whose institution UUID is BSON subtype 4", async () => {
    const result = await getCollectionRequestsByBloodBank("blood-bank-id");

    expect(mocks.getInstitutionsByIds).toHaveBeenCalledWith([institutionId]);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      institutionName: "Instituição teste",
    });
  });
});
