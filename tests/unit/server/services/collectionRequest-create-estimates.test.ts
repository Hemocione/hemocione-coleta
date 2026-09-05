import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionRequestSchema } from "~/server/models/collectionRequest";
import { createCollectionRequest } from "~/server/services/collectionRequest";
import { Types } from "mongoose";

const mocks = vi.hoisted(() => {
  const CollectionRequestMock: any = vi.fn(function (this: any, data: any) {
    this.data = data;
    this.save = vi.fn().mockResolvedValue({ _id: new Types.ObjectId() });
  });
  CollectionRequestMock.findOne = vi.fn();
  CollectionRequestMock.find = vi.fn();
  return {
    CollectionRequestMock,
    collectionRequestFindOne: CollectionRequestMock.findOne,
    bloodBankFindOne: vi.fn(),
    availableDateFind: vi.fn(),
    technicalVisitFindOne: vi.fn(),
    getInstitutionsByIds: vi.fn(),
    notifyCollectionRequestStatusTransition: vi.fn(),
  };
});

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: mocks.CollectionRequestMock,
  },
  bloodBank: {
    BloodBank: {
      findOne: (...args: unknown[]) => mocks.bloodBankFindOne(...args),
    },
  },
  availableDate: {
    AvailableDate: {
      find: (...args: unknown[]) => mocks.availableDateFind(...args),
    },
  },
  team: { Team: {} },
  technicalVisit: {
    TechnicalVisit: {
      findOne: (...args: unknown[]) => mocks.technicalVisitFindOne(...args),
    },
  },
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

describe("estimativas de público e bolsas na CollectionRequest", () => {
  it("expõe os campos estimatedAttendees e expectedBags no schema", () => {
    expect(CollectionRequestSchema.path("estimatedAttendees")).toBeDefined();
    expect(CollectionRequestSchema.path("venueAudienceSize")).toBeDefined();
    expect(CollectionRequestSchema.path("expectedBags")).toBeDefined();
    expect(
      CollectionRequestSchema.path("estimatedAttendees").options.min
    ).toBe(1);
    expect(
      CollectionRequestSchema.path("venueAudienceSize").options.min
    ).toBe(1);
    expect(CollectionRequestSchema.path("expectedBags").options.min).toBe(1);
  });
});

describe("createCollectionRequest com estimativas", () => {
  const availableDateId = new Types.ObjectId();
  const savedDoc = {
    _id: new Types.ObjectId(),
    institutionId: "institution-a",
    bloodBanksLocationId: "blood-bank-a",
    status: "pending",
    requestedDates: [{ availableDateId }],
    host: { name: "Pessoa responsável", email: "p@example.com", phone: "1199" },
    statusHistory: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.bloodBankFindOne.mockResolvedValue({ active: true });
    // findRequestedDateConflicts: sem conflitos
    mocks.CollectionRequestMock.find.mockReturnValue({
      lean: async () => [],
    });
    // Validação de datas (await direto) + getById (populate().lean())
    mocks.availableDateFind.mockImplementation(() => {
      const availableDate = {
        _id: availableDateId,
        date: "2026-10-10",
        slots: [],
      };
      const p: any = Promise.resolve([availableDate]);
      p.populate = vi.fn().mockReturnThis();
      p.lean = vi.fn().mockResolvedValue([availableDate]);
      return p;
    });
    // getCollectionRequestById: busca o documento salvo (simula persistência
    // devolvendo o que o construtor capturou)
    mocks.collectionRequestFindOne.mockImplementation(() => ({
      lean: async () => ({
        ...savedDoc,
        ...(mocks.CollectionRequestMock.mock.instances[0]?.data || {}),
      }),
    }));
    mocks.getInstitutionsByIds.mockResolvedValue([
      { id: "institution-a", name: "Instituição teste", status: "validated" },
    ]);
    mocks.technicalVisitFindOne.mockResolvedValue(null);
  });

  const baseData = {
    institutionId: "institution-a",
    requestedByUserId: "institution-user",
    requestedDates: [{ availableDateId: availableDateId.toString() }],
    host: { name: "Pessoa responsável", email: "p@example.com", phone: "1199" },
  };

  it("persiste participantes esperados e público do recinto na solicitação", async () => {
    const result = await createCollectionRequest("blood-bank-a", {
      ...baseData,
      estimatedAttendees: 300,
      venueAudienceSize: 1200,
    } as any);

    const ctor = mocks.CollectionRequestMock;
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor.mock.instances[0].data.estimatedAttendees).toBe(300);
    expect(ctor.mock.instances[0].data.venueAudienceSize).toBe(1200);
    expect(result.estimatedAttendees).toBe(300);
    expect(result.venueAudienceSize).toBe(1200);
  });

  it("persiste expectedBags quando informado (registros legados)", async () => {
    const result = await createCollectionRequest("blood-bank-a", {
      ...baseData,
      estimatedAttendees: 300,
      expectedBags: 120,
    } as any);

    const ctor = mocks.CollectionRequestMock;
    expect(ctor.mock.instances[0].data.expectedBags).toBe(120);
    expect(result.expectedBags).toBe(120);
  });

  it("permite criar sem estimativas (campos opcionais)", async () => {
    const result = await createCollectionRequest("blood-bank-a", baseData as any);

    const ctor = mocks.CollectionRequestMock;
    expect(ctor.mock.instances[0].data.estimatedAttendees).toBeUndefined();
    expect(ctor.mock.instances[0].data.expectedBags).toBeUndefined();
    expect(result.estimatedAttendees).toBeUndefined();
    expect(result.expectedBags).toBeUndefined();
  });
});
