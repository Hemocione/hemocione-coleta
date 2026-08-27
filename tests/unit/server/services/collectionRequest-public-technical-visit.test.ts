import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCollectionRequestPublic,
  getCollectionRequestPublicByToken,
} from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  getInstitutionsByIds: vi.fn(),
  bloodBankFindOne: vi.fn(),
  availableDateFind: vi.fn(),
  getTechnicalVisitById: vi.fn(),
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

vi.mock("~/server/services/technicalVisit", () => ({
  createTechnicalVisit: vi.fn(),
  getTechnicalVisitById: (...args: unknown[]) =>
    mocks.getTechnicalVisitById(...args),
}));

const visitDate = new Date("2026-09-11T14:00:00.000Z");

const technicalVisitDoc = {
  _id: "visit-a",
  bloodBanksLocationId: "blood-bank-a",
  institutionId: "institution-a",
  address: "Rua A, 10, Centro, São Paulo - SP, 01000000",
  visitDate,
  outcome: "pending",
  notes: "Levar crachá",
  visitedBy: "blood-bank-staff-user",
  deletedAt: null,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  updatedAt: new Date("2026-08-20T00:00:00.000Z"),
};

function mockRequest(overrides: Record<string, unknown> = {}) {
  mocks.collectionRequestFindOne.mockReturnValue({
    lean: () =>
      Promise.resolve({
        _id: "request-a",
        status: "awaiting_technical_visit",
        institutionId: "institution-a",
        bloodBanksLocationId: "blood-bank-a",
        host: { name: "Fulano", email: "a@a.com", phone: "11999999999" },
        requestedDates: [],
        statusHistory: [],
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        ...overrides,
      }),
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());

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

describe("getCollectionRequestPublicByToken - visita técnica agendada", () => {
  it("expõe cada data solicitada uma única vez quando há vários slots na mesma data", async () => {
    mockRequest({
      requestedDates: [
        {
          availableDateId: "available-date-a",
          slotIds: ["slot-a", "slot-b"],
          priority: 1,
        },
      ],
    });
    mocks.availableDateFind.mockReturnValue({
      populate: () => ({
        lean: () =>
          Promise.resolve([
            {
              _id: "available-date-a",
              date: "2026-09-03",
              slots: [
                {
                  _id: "slot-a",
                  startTime: "08:00",
                  endTime: "17:00",
                  teamId: { name: "Equipe A" },
                },
                {
                  _id: "slot-b",
                  startTime: "08:00",
                  endTime: "17:00",
                  teamId: { name: "Equipe B" },
                },
              ],
            },
          ]),
      }),
    });

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(result?.requestedDates).toEqual([{ date: "2026-09-03" }]);
  });

  it("expõe id/visitDate/address/outcome/notes sem vazar dados internos da visita", async () => {
    mockRequest({ technicalVisitId: "visit-a" });
    mocks.getTechnicalVisitById.mockResolvedValue(technicalVisitDoc);

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(mocks.getTechnicalVisitById).toHaveBeenCalledWith(
      "blood-bank-a",
      "visit-a"
    );
    expect(result?.technicalVisit).toEqual({
      id: "visit-a",
      visitDate,
      address: "Rua A, 10, Centro, São Paulo - SP, 01000000",
      outcome: "pending",
      notes: "Levar crachá",
    });
    expect(result?.technicalVisit).not.toHaveProperty("visitedBy");
    expect(result?.technicalVisit).not.toHaveProperty("institutionId");
    expect(result?.technicalVisit).not.toHaveProperty("bloodBanksLocationId");
    expect(result?.technicalVisit).not.toHaveProperty("deletedAt");
  });

  it("não inclui notes quando a visita não tem observações", async () => {
    mockRequest({ technicalVisitId: "visit-a" });
    mocks.getTechnicalVisitById.mockResolvedValue({
      ...technicalVisitDoc,
      notes: null,
    });

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(result?.technicalVisit).toEqual({
      id: "visit-a",
      visitDate,
      address: "Rua A, 10, Centro, São Paulo - SP, 01000000",
      outcome: "pending",
    });
    expect(result?.technicalVisit).not.toHaveProperty("notes");
  });

  it("não consulta visita nem expõe technicalVisit quando a solicitação não tem visita ligada", async () => {
    mockRequest();

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(mocks.getTechnicalVisitById).not.toHaveBeenCalled();
    expect(result?.technicalVisit).toBeUndefined();
  });

  it.each([
    ["visita inexistente", null],
    ["visita removida (deletedAt)", null],
  ])("retorna technicalVisit undefined sem crash quando há %s", async (_label, visit) => {
    mockRequest({ technicalVisitId: "visit-sumida" });
    mocks.getTechnicalVisitById.mockResolvedValue(visit);

    await expect(
      getCollectionRequestPublicByToken("token-a")
    ).resolves.toMatchObject({ _id: "request-a" });
    expect(
      (await getCollectionRequestPublicByToken("token-a"))?.technicalVisit
    ).toBeUndefined();
  });

  it("expõe a assinatura pública do termo mais recente da solicitação", async () => {
    mockRequest();
    mocks.commitmentTermFindOne.mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: () =>
            Promise.resolve({
              accessToken: "term-public-token",
              status: "sent",
              createdAt: new Date("2026-08-27T12:00:00.000Z"),
              signedByName: "Maria da Silva",
              signedAt: new Date("2026-08-27T12:00:00.000Z"),
              sentTo: "sensitive@example.com",
            }),
        }),
      }),
    });

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(result?.commitmentTerm).toEqual({
      accessToken: "term-public-token",
      status: "sent",
      createdAt: new Date("2026-08-27T12:00:00.000Z"),
      signedByName: "Maria da Silva",
      signedAt: new Date("2026-08-27T12:00:00.000Z"),
    });
    expect(result?.commitmentTerm).not.toHaveProperty("sentTo");
  });

  it("projeta somente os campos públicos do termo mais recente", async () => {
    mockRequest();
    const query = {
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        accessToken: "term-public-token",
        status: "sent",
        createdAt: new Date("2026-08-27T13:00:00.000Z"),
        signedByName: "Ana Silva",
        signedAt: new Date("2026-08-27T13:05:00.000Z"),
        _id: "internal-term-id",
        generatedContent: "sensitive content",
      }),
    };
    mocks.commitmentTermFindOne.mockReturnValue(query);

    const result = await getCollectionRequestPublicByToken("token-a");

    expect(mocks.commitmentTermFindOne).toHaveBeenCalledWith({
      bloodBanksLocationId: "blood-bank-a",
      collectionRequestId: "request-a",
    });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.select).toHaveBeenCalledWith(
      "accessToken createdAt status signedByName signedAt"
    );
    expect(result?.commitmentTerm).toEqual({
      accessToken: "term-public-token",
      status: "sent",
      createdAt: new Date("2026-08-27T13:00:00.000Z"),
      signedByName: "Ana Silva",
      signedAt: new Date("2026-08-27T13:05:00.000Z"),
    });
    expect(result?.commitmentTerm).not.toHaveProperty("_id");
    expect(result?.commitmentTerm).not.toHaveProperty("generatedContent");
  });

  it("não expõe o token do termo na consulta pública por id", async () => {
    mockRequest();
    mocks.commitmentTermFindOne.mockReturnValue({
      sort: () => ({
        select: () => ({
          lean: () =>
            Promise.resolve({
              accessToken: "term-public-token",
              status: "sent",
              createdAt: new Date("2026-08-27T13:00:00.000Z"),
              signedByName: "Ana Silva",
              signedAt: new Date("2026-08-27T13:05:00.000Z"),
            }),
        }),
      }),
    });

    const result = await getCollectionRequestPublic("request-a");

    expect(result?.commitmentTerm).toMatchObject({ signedByName: "Ana Silva" });
    expect(result?.commitmentTerm).not.toHaveProperty("accessToken");
  });
});
