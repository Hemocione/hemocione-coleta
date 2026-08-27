import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCollectionRequestPublicByToken } from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  getInstitutionsByIds: vi.fn(),
  bloodBankFindOne: vi.fn(),
  availableDateFind: vi.fn(),
  commitmentTermFindOne: vi.fn(),
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
    AvailableDate: {
      find: (...args: unknown[]) => mocks.availableDateFind(...args),
    },
  },
  team: { Team: {} },
  technicalVisit: { TechnicalVisit: {} },
  commitmentTerm: {
    CommitmentTerm: {
      findOne: (...args: unknown[]) => mocks.commitmentTermFindOne(...args),
    },
  },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: (...args: unknown[]) => mocks.getInstitutionsByIds(...args),
}));

const proposedDates = [
  {
    date: new Date("2026-09-10T00:00:00.000Z"),
    startTime: "08:30",
    durationMinutes: 45,
    note: "Primeiro horário",
  },
];

beforeEach(() => {
  mocks.collectionRequestFindOne.mockReset();
  mocks.getInstitutionsByIds.mockReset();
  mocks.bloodBankFindOne.mockReset();
  mocks.availableDateFind.mockReset();
  mocks.commitmentTermFindOne.mockReset();

  mocks.getInstitutionsByIds.mockResolvedValue([{ id: "institution-a", name: "Instituição A" }]);
  mocks.bloodBankFindOne.mockReturnValue({ lean: () => Promise.resolve({ name: "Banco A" }) });
  mocks.availableDateFind.mockReturnValue({
    populate: () => ({ lean: () => Promise.resolve([]) }),
  });
  mocks.commitmentTermFindOne.mockReturnValue({
    sort: () => ({
      select: () => ({ lean: () => Promise.resolve(null) }),
    }),
  });
});

describe("getCollectionRequestPublicByToken - contraproposta", () => {
  it("expõe proposedDates/needsTechnicalVisit/note/proposedAt sem vazar proposedBy", async () => {
    mocks.collectionRequestFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: "request-a",
          status: "counter_proposed",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-a",
          host: { name: "Fulano", email: "a@a.com", phone: "11999999999" },
          requestedDates: [],
          statusHistory: [],
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          counterProposal: {
            proposedDates,
            needsTechnicalVisit: true,
            note: "Podemos nestas datas",
            proposedBy: "blood-bank-staff-user",
            proposedAt: new Date("2026-08-13T00:00:00.000Z"),
          },
        }),
    });

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(result?.counterProposal).toEqual({
      proposedDates,
      needsTechnicalVisit: true,
      note: "Podemos nestas datas",
      proposedAt: new Date("2026-08-13T00:00:00.000Z"),
    });
    expect(result?.counterProposal).not.toHaveProperty("proposedBy");
    expect(result?.counterProposal).not.toHaveProperty("response");
  });

  it("não inclui counterProposal quando a solicitação não tem contraproposta ativa", async () => {
    mocks.collectionRequestFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: "request-a",
          status: "pending",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-a",
          host: { name: "Fulano", email: "a@a.com", phone: "11999999999" },
          requestedDates: [],
          statusHistory: [],
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        }),
    });

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(result?.counterProposal).toBeUndefined();
  });

  it("expõe a data e o intervalo confirmado após aceitar uma contraproposta", async () => {
    mocks.collectionRequestFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: "request-a",
          status: "accepted",
          institutionId: "institution-a",
          bloodBanksLocationId: "blood-bank-a",
          host: { name: "Fulano", email: "a@a.com", phone: "11999999999" },
          requestedDates: [],
          statusHistory: [],
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          confirmedSchedule: {
            date: new Date("2026-09-11T00:00:00.000Z"),
            startTime: "14:00",
            durationMinutes: 60,
          },
        }),
    });

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(result?.confirmedSchedule).toEqual({
      date: new Date("2026-09-11T00:00:00.000Z"),
      startTime: "14:00",
      endTime: "15:00",
      durationMinutes: 60,
    });
  });
});
