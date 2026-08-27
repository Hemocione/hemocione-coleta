import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollectionRequest } from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFind: vi.fn(),
  collectionRequestFindOne: vi.fn(),
  collectionRequestSave: vi.fn(),
  bloodBankFindOne: vi.fn(),
  availableDateFind: vi.fn(),
  getInstitutionsByIds: vi.fn(),
}));

function chainable<T>(result: T) {
  const promise = Promise.resolve(result) as Promise<T> & {
    lean: () => Promise<T>;
    populate: () => ReturnType<typeof chainable<T>>;
  };
  promise.lean = () => Promise.resolve(result);
  promise.populate = () => chainable(result);
  return promise;
}

vi.mock("~/server/models", () => {
  class FakeCollectionRequest {
    constructor(data: any) {
      Object.assign(this, data);
    }

    save() {
      return mocks.collectionRequestSave.call(this, this);
    }
  }

  (FakeCollectionRequest as any).find = (...args: unknown[]) =>
    mocks.collectionRequestFind(...args);
  (FakeCollectionRequest as any).findOne = (...args: unknown[]) =>
    mocks.collectionRequestFindOne(...args);

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

const DATE_A_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DATE_B_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SLOT_A_ID = "111111111111111111111111";
const SLOT_B_ID = "222222222222222222222222";

const availableDates = [
  {
    _id: DATE_A_ID,
    date: "2026-09-10",
    slots: [
      { _id: SLOT_A_ID, locked: false, lockedBy: null },
      { _id: SLOT_B_ID, locked: false, lockedBy: null },
    ],
  },
  {
    _id: DATE_B_ID,
    date: "2026-09-11",
    slots: [{ _id: "333333333333333333333333", locked: false, lockedBy: null }],
  },
];

const baseHost = {
  name: "Pessoa responsável",
  email: "pessoa@example.com",
  phone: "11999999999",
};

const savedRequest = {
  _id: "request-new",
  institutionId: "institution-a",
  bloodBanksLocationId: "blood-bank-a",
  requestedDates: [{ availableDateId: DATE_A_ID, priority: 1 }],
  host: baseHost,
  status: "pending",
  statusHistory: [],
};

function requestData(
  requestedDates: Array<{ availableDateId: string; slotIds?: string[] }>
) {
  return {
    institutionId: "institution-a",
    requestedByUserId: "institution-user",
    requestedDates,
    host: baseHost,
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.bloodBankFindOne.mockResolvedValue({ active: true });
  mocks.collectionRequestFind.mockReturnValue(chainable([]));
  mocks.collectionRequestFindOne.mockReturnValue(chainable(savedRequest));
  mocks.collectionRequestSave.mockResolvedValue(savedRequest);
  mocks.availableDateFind.mockImplementation((query: any) => {
    const ids = query._id?.$in?.map((id: any) => id.toString()) || [];
    return chainable(availableDates.filter((date) => ids.includes(date._id)));
  });
  mocks.getInstitutionsByIds.mockResolvedValue([
    { id: "institution-a", name: "Instituição A" },
  ]);
});

function setExistingRequest(
  requestedDates: Array<{ availableDateId: string; slotIds?: string[] }>
) {
  mocks.collectionRequestFind.mockReturnValue(
    chainable([
      {
        institutionId: "institution-a",
        bloodBanksLocationId: "blood-bank-a",
        requestedDates,
        status: "pending",
      },
    ])
  );
}

describe("createCollectionRequest — conflito de datas e slots", () => {
  it("permite outra solicitação para uma data distinta", async () => {
    setExistingRequest([{ availableDateId: DATE_A_ID, slotIds: [SLOT_A_ID] }]);

    await expect(
      createCollectionRequest(
        "blood-bank-a",
        requestData([{ availableDateId: DATE_B_ID, slotIds: [SLOT_B_ID] }])
      )
    ).resolves.toEqual(expect.objectContaining({ _id: "request-new" }));

    expect(mocks.collectionRequestSave).toHaveBeenCalledTimes(1);
  });

  it("permite a mesma data quando os slots específicos são diferentes", async () => {
    setExistingRequest([{ availableDateId: DATE_A_ID, slotIds: [SLOT_A_ID] }]);

    await expect(
      createCollectionRequest(
        "blood-bank-a",
        requestData([{ availableDateId: DATE_A_ID, slotIds: [SLOT_B_ID] }])
      )
    ).resolves.toEqual(expect.objectContaining({ _id: "request-new" }));
  });

  it("rejeita 409 quando o mesmo slot específico é solicitado novamente", async () => {
    setExistingRequest([{ availableDateId: DATE_A_ID, slotIds: [SLOT_A_ID] }]);

    await expect(
      createCollectionRequest(
        "blood-bank-a",
        requestData([{ availableDateId: DATE_A_ID, slotIds: [SLOT_A_ID] }])
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("já possui uma solicitação em aberto"),
    });

    expect(mocks.collectionRequestSave).not.toHaveBeenCalled();
  });

  it("rejeita 409 quando uma solicitação sem slot específico conflita na data", async () => {
    setExistingRequest([{ availableDateId: DATE_A_ID, slotIds: [SLOT_A_ID] }]);

    await expect(
      createCollectionRequest(
        "blood-bank-a",
        requestData([{ availableDateId: DATE_A_ID }])
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
