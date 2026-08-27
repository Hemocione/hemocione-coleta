import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { CollectionRequestSchema } from "~/server/models/collectionRequest";

const CollectionRequestProposalDateTestModel = mongoose.model(
  "CollectionRequestProposalDateTest",
  CollectionRequestSchema
);

const baseRequest = {
  institutionId: "550e8400-e29b-41d4-a716-446655440000",
  requestedByUserId: "550e8400-e29b-41d4-a716-446655440001",
  bloodBanksLocationId: "550e8400-e29b-41d4-a716-446655440002",
  requestedDates: [
    {
      availableDateId: new mongoose.Types.ObjectId(),
      priority: 1,
    },
  ],
  host: {
    name: "Pessoa responsável",
    email: "pessoa@example.com",
    phone: "11999999999",
  },
};

const proposalBase = {
  needsTechnicalVisit: false,
  note: "Opção de horário",
  proposedBy: "550e8400-e29b-41d4-a716-446655440003",
  proposedAt: new Date("2026-08-13T00:00:00.000Z"),
};

describe("CollectionRequest proposal date schema", () => {
  it("stores endTime for counter-proposals and technical visit proposals", () => {
    const doc = new CollectionRequestProposalDateTestModel({
      ...baseRequest,
      requestedDates: [
        {
          ...baseRequest.requestedDates[0],
          startTime: "08:00",
          endTime: "10:00",
        },
      ],
      counterProposal: {
        ...proposalBase,
        proposedDates: [
          {
            date: new Date("2026-09-10T03:00:00.000Z"),
            startTime: "09:00",
            endTime: "10:00",
            note: "Contraproposta",
          },
        ],
      },
      visitProposal: {
        proposedDates: [
          {
            date: new Date("2026-09-11T03:00:00.000Z"),
            startTime: "14:00",
            endTime: "15:30",
            note: "Visita técnica",
          },
        ],
        note: "Escolha uma opção",
        proposedBy: proposalBase.proposedBy,
        proposedAt: proposalBase.proposedAt,
      },
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.get("requestedDates.0.startTime")).toBe("08:00");
    expect(doc.get("requestedDates.0.endTime")).toBe("10:00");
    expect(doc.get("counterProposal.proposedDates.0.endTime")).toBe("10:00");
    expect(doc.get("visitProposal.proposedDates.0.endTime")).toBe("15:30");
  });

  it("accepts duration-only legacy proposal dates", () => {
    const doc = new CollectionRequestProposalDateTestModel({
      ...baseRequest,
      counterProposal: {
        ...proposalBase,
        proposedDates: [
          {
            date: new Date("2026-09-10T03:00:00.000Z"),
            startTime: "09:00",
            durationMinutes: 60,
            note: "Formato legado",
          },
        ],
      },
    });

    expect(doc.validateSync()).toBeUndefined();
  });
});
