import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCollectionRequest,
  getCollectionRequestById,
} from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFind: vi.fn(),
  collectionRequestFindOne: vi.fn(),
  collectionRequestSave: vi.fn(),
  bloodBankFindOne: vi.fn(),
  availableDateFind: vi.fn(),
  getInstitutionsByIds: vi.fn(),
}));

// Retorna um valor "chainable" que também é diretamente awaitable — imita o
// comportamento de uma Query do mongoose, que pode ser aguardada direto ou
// encadeada com .lean()/.populate()/etc antes de ser aguardada.
function chainable<T>(result: T) {
  const promise = Promise.resolve(result) as Promise<T> & {
    lean: () => Promise<T>;
    populate: () => Promise<T>;
    session: () => Promise<T>;
    sort: () => Promise<T>;
    skip: () => Promise<T>;
    limit: () => Promise<T>;
  };
  promise.lean = () => Promise.resolve(result);
  promise.populate = () => chainable(result);
  promise.session = () => chainable(result);
  promise.sort = () => chainable(result);
  promise.skip = () => chainable(result);
  promise.limit = () => chainable(result);
  return promise;
}

vi.mock("~/server/models", () => {
  class FakeCollectionRequest {
    requestedDates: any[] = [];
    constructor(data: any) {
      Object.assign(this, data);
    }
    save() {
      return mocks.collectionRequestSave.call(this, this);
    }
  }
  (FakeCollectionRequest as any).findOne = (...args: unknown[]) =>
    mocks.collectionRequestFindOne(...args);
  (FakeCollectionRequest as any).find = (...args: unknown[]) =>
    mocks.collectionRequestFind(...args);

  return {
    collectionRequest: { CollectionRequest: FakeCollectionRequest },
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
    commitmentTerm: { CommitmentTerm: {} },
  };
});

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

const DATE_A_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DATE_B_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const availableDatesWithSlots = [
  {
    _id: DATE_A_ID,
    date: "2026-09-10",
    slots: [
      {
        _id: "slot-a1",
        startTime: new Date("2026-09-10T09:00:00Z"),
        endTime: new Date("2026-09-10T10:00:00Z"),
        locked: false,
        lockedBy: null,
        teamId: { name: "Equipe A", color: "#111111" },
      },
    ],
  },
  {
    _id: DATE_B_ID,
    date: "2026-09-11",
    slots: [
      {
        _id: "slot-b1",
        startTime: new Date("2026-09-11T09:00:00Z"),
        endTime: new Date("2026-09-11T10:00:00Z"),
        locked: false,
        lockedBy: null,
        teamId: { name: "Equipe B", color: "#222222" },
      },
    ],
  },
];

beforeEach(() => {
  mocks.collectionRequestFindOne.mockReset();
  mocks.collectionRequestFind.mockReset();
  mocks.collectionRequestSave.mockReset();
  mocks.bloodBankFindOne.mockReset();
  mocks.availableDateFind.mockReset();
  mocks.getInstitutionsByIds.mockReset();

  mocks.getInstitutionsByIds.mockResolvedValue([
    { id: "institution-a", name: "Instituição A" },
  ]);
});

describe("createCollectionRequest — atribuição de priority", () => {
  const savedRequestLean = {
    _id: "request-x",
    institutionId: "institution-a",
    requestedDates: [
      { availableDateId: DATE_A_ID, priority: 1 },
      { availableDateId: DATE_B_ID, priority: 2 },
    ],
    host: baseHost,
    status: "pending",
    statusHistory: [],
  };

  beforeEach(() => {
    mocks.collectionRequestFind.mockReturnValue(chainable([]));
    mocks.bloodBankFindOne.mockResolvedValue({ active: true });
    mocks.collectionRequestFindOne.mockImplementation((query: any) =>
      "status" in query ? chainable(null) : chainable(savedRequestLean)
    );
    mocks.availableDateFind.mockImplementation((query: any) =>
      "bloodBanksLocationId" in query
        ? chainable([{ _id: DATE_A_ID }, { _id: DATE_B_ID }])
        : chainable(availableDatesWithSlots)
    );
  });

  it("preenche priority sequencialmente pela posição quando nenhuma data informa prioridade", async () => {
    let savedPriorities: number[] = [];
    mocks.collectionRequestSave.mockImplementation(function (this: any) {
      savedPriorities = this.requestedDates.map((rd: any) => rd.priority);
      return Promise.resolve(savedRequestLean);
    });

    await createCollectionRequest("blood-bank-a", {
      institutionId: "institution-a",
      requestedByUserId: "user-a",
      requestedDates: [
        { availableDateId: DATE_A_ID },
        { availableDateId: DATE_B_ID },
      ],
      host: baseHost,
    });

    expect(savedPriorities).toEqual([1, 2]);
  });

  it("preserva as prioridades explícitas informadas pelo chamador", async () => {
    let savedPriorities: number[] = [];
    mocks.collectionRequestSave.mockImplementation(function (this: any) {
      savedPriorities = this.requestedDates.map((rd: any) => rd.priority);
      return Promise.resolve(savedRequestLean);
    });

    await createCollectionRequest("blood-bank-a", {
      institutionId: "institution-a",
      requestedByUserId: "user-a",
      requestedDates: [
        { availableDateId: DATE_A_ID, priority: 2 },
        { availableDateId: DATE_B_ID, priority: 1 },
      ],
      host: baseHost,
    });

    expect(savedPriorities).toEqual([2, 1]);
  });
});

describe("getCollectionRequestById — ordenação por priority", () => {
  it("ordena availableSlotOptions da data mais preferida (priority 1) para a menos preferida, e expõe priority em cada opção", async () => {
    const requestWithMixedPriorities = {
      _id: "request-x",
      institutionId: "institution-a",
      bloodBanksLocationId: "blood-bank-a",
      requestedDates: [
        { availableDateId: DATE_A_ID, priority: 2 },
        { availableDateId: DATE_B_ID, priority: 1 },
      ],
      host: baseHost,
      status: "pending",
      statusHistory: [],
    };

    mocks.collectionRequestFindOne.mockImplementation(() =>
      chainable(requestWithMixedPriorities)
    );
    mocks.availableDateFind.mockImplementation(() =>
      chainable(availableDatesWithSlots)
    );

    const result = await getCollectionRequestById(
      "request-x",
      "blood-bank-a"
    );

    expect(
      result?.availableSlotOptions.map((o) => o.availableDateId)
    ).toEqual([DATE_B_ID, DATE_A_ID]);
    expect(result?.availableSlotOptions.map((o) => (o as any).priority)).toEqual([
      1, 2,
    ]);
  });

  it("marca slots específicos e todos os slots de uma data wildcard como solicitados", async () => {
    const requestWithRequestedSlots = {
      _id: "request-x",
      institutionId: "institution-a",
      bloodBanksLocationId: "blood-bank-a",
      requestedDates: [
        { availableDateId: DATE_A_ID, slotIds: ["slot-a1"], priority: 1 },
        { availableDateId: DATE_B_ID, priority: 2 },
      ],
      host: baseHost,
      status: "pending",
      statusHistory: [],
    };

    mocks.collectionRequestFindOne.mockImplementation(() =>
      chainable(requestWithRequestedSlots)
    );
    mocks.availableDateFind.mockImplementation(() =>
      chainable(availableDatesWithSlots)
    );

    const result = await getCollectionRequestById(
      "request-x",
      "blood-bank-a"
    );

    expect(
      result?.availableSlotOptions.map((option) => ({
        availableDateId: option.availableDateId,
        slotId: option.slotId,
        isRequested: option.isRequested,
      }))
    ).toEqual([
      { availableDateId: DATE_A_ID, slotId: "slot-a1", isRequested: true },
      { availableDateId: DATE_B_ID, slotId: "slot-b1", isRequested: true },
    ]);
  });

  it("expõe slots futuros configurados para contraproposta fora das datas solicitadas", async () => {
    const futureDate = {
      _id: "cccccccccccccccccccccccc",
      date: "2026-09-12",
      slots: [
        {
          _id: "slot-c1",
          startTime: new Date("2026-09-12T12:00:00Z"),
          endTime: new Date("2026-09-12T13:00:00Z"),
          locked: false,
          lockedBy: null,
          teamId: { name: "Equipe C", color: "#333333" },
        },
      ],
    };
    const requestWithOneDate = {
      _id: "request-x",
      institutionId: "institution-a",
      bloodBanksLocationId: "blood-bank-a",
      requestedDates: [{ availableDateId: DATE_A_ID, priority: 1 }],
      host: baseHost,
      status: "pending",
      statusHistory: [],
    };

    mocks.collectionRequestFindOne.mockImplementation(() =>
      chainable(requestWithOneDate)
    );
    mocks.availableDateFind.mockImplementation(() =>
      chainable([availableDatesWithSlots[0], futureDate])
    );

    const result = await getCollectionRequestById(
      "request-x",
      "blood-bank-a"
    );

    expect(result?.availableSlotOptions.map((option) => option.date)).toEqual([
      "2026-09-10",
    ]);
    expect(
      result?.availableCounterProposalOptions.map((option) => option.date)
    ).toEqual(["2026-09-10", "2026-09-12"]);
  });
});
