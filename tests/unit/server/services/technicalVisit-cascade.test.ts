import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateTechnicalVisit } from "~/server/services/technicalVisit";

const mocks = vi.hoisted(() => ({
  technicalVisitFindOne: vi.fn(),
  technicalVisitFindOneAndUpdate: vi.fn(),
  collectionRequestFindOneAndUpdate: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  technicalVisit: {
    TechnicalVisit: {
      findOne: (...args: unknown[]) => mocks.technicalVisitFindOne(...args),
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.technicalVisitFindOneAndUpdate(...args),
    },
  },
  collectionRequest: {
    CollectionRequest: {
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.collectionRequestFindOneAndUpdate(...args),
    },
  },
}));

const bloodBanksLocationId = "blood-bank-a";
const visitId = "visit-a";
const actorId = "blood-bank-user";

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.technicalVisitFindOne.mockResolvedValue({
    _id: visitId,
    visitedBy: "visit-creator",
  });
  mocks.technicalVisitFindOneAndUpdate.mockImplementation(
    async (_query: unknown, updates: Record<string, unknown>) => ({
      _id: visitId,
      visitedBy: "visit-creator",
      notes: updates.notes,
    })
  );
});

describe("cascata do veredito da visita técnica", () => {
  it.each([
    {
      outcome: "approved" as const,
      expectedStatus: "technical_visit_confirmed",
      updates: { outcome: "approved" as const },
    },
    {
      outcome: "rejected" as const,
      expectedStatus: "rejected",
      updates: {
        outcome: "rejected" as const,
        notes: "Endereço não atende aos requisitos",
      },
    },
  ])(
    "atualiza a solicitação para $expectedStatus quando a visita é $outcome",
    async ({ expectedStatus, updates }) => {
      await updateTechnicalVisit(
        bloodBanksLocationId,
        visitId,
        updates,
        actorId
      );

      expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledWith(
        {
          technicalVisitId: visitId,
          bloodBanksLocationId,
          status: "awaiting_technical_visit",
          deletedAt: null,
        },
        expect.objectContaining({
          $set: expect.objectContaining({ status: expectedStatus }),
          $push: {
            statusHistory: expect.objectContaining({
              status: expectedStatus,
              changedBy: actorId,
            }),
          },
        }),
        { new: true }
      );

      if (expectedStatus === "rejected") {
        const update = mocks.collectionRequestFindOneAndUpdate.mock.calls[0][1];
        expect(update.$set.rejectionReason).toBe(
          "Endereço não atende aos requisitos"
        );
      }
    }
  );
});
