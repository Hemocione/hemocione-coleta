import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptCollectionRequest,
  markCollectionRequestScheduled,
  registerRetroactiveVisit,
  reuseTechnicalVisit,
  scheduleNewTechnicalVisit,
} from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  collectionRequestFindOneAndUpdate: vi.fn(),
  collectionRequestStartSession: vi.fn(),
  availableDateFindOne: vi.fn(),
  availableDateFindOneAndUpdate: vi.fn(),
  availableDateFind: vi.fn(),
  getInstitutionsByIds: vi.fn(),
  createTechnicalVisit: vi.fn(),
  getTechnicalVisitById: vi.fn(),
  notifyCollectionRequestStatusTransition: vi.fn(),
  session: {
    withTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    abortTransaction: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.collectionRequestFindOneAndUpdate(...args),
      startSession: (...args: unknown[]) =>
        mocks.collectionRequestStartSession(...args),
    },
  },
  availableDate: {
    AvailableDate: {
      findOne: (...args: unknown[]) => mocks.availableDateFindOne(...args),
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.availableDateFindOneAndUpdate(...args),
      find: (...args: unknown[]) => mocks.availableDateFind(...args),
    },
  },
  bloodBank: { BloodBank: {} },
  team: { Team: {} },
  technicalVisit: { TechnicalVisit: {} },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: (...args: unknown[]) =>
    mocks.getInstitutionsByIds(...args),
}));

vi.mock("~/server/services/technicalVisit", () => ({
  createTechnicalVisit: (...args: unknown[]) =>
    mocks.createTechnicalVisit(...args),
  getTechnicalVisitById: (...args: unknown[]) =>
    mocks.getTechnicalVisitById(...args),
}));

vi.mock("~/server/services/collectionRequestNotification", () => ({
  notifyCollectionRequestStatusTransition: (...args: unknown[]) =>
    mocks.notifyCollectionRequestStatusTransition(...args),
}));

const requestId = "request-a";
const bloodBanksLocationId = "blood-bank-a";
const changedByUserId = "staff-user-a";
const availableDateId = "507f1f77bcf86cd799439011";
const slotId = "507f1f77bcf86cd799439012";
const awaitingRequest = {
  _id: requestId,
  institutionId: "institution-a",
  status: "awaiting_technical_visit",
  address: {
    street: "Rua A",
    number: "10",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    zipCode: "01000000",
  },
};

function queryWithSession<T>(value: T) {
  return {
    session: vi.fn().mockResolvedValue(value),
  };
}

function prepareAcceptRequest(request: Record<string, unknown>) {
  mocks.collectionRequestFindOne
    .mockReturnValueOnce(queryWithSession(request))
    .mockReturnValueOnce({ lean: async () => request });
  mocks.availableDateFindOne.mockReturnValue(
    queryWithSession({
      slots: {
        id: () => ({ locked: false, lockedBy: null }),
      },
    })
  );
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => {
    if (typeof mock === "function") mock.mockReset();
  });
  Object.values(mocks.session).forEach((mock) => mock.mockReset());
  mocks.collectionRequestStartSession.mockResolvedValue(mocks.session);
  mocks.session.withTransaction.mockImplementation(async (callback) => {
    try {
      await callback();
      await mocks.session.commitTransaction();
    } catch (error) {
      await mocks.session.abortTransaction();
      throw error;
    }
  });
  mocks.session.endSession.mockResolvedValue(undefined);
  mocks.getInstitutionsByIds.mockResolvedValue([]);
  mocks.availableDateFind.mockReturnValue({
    populate: () => ({ lean: async () => [] }),
  });
  mocks.collectionRequestFindOneAndUpdate.mockResolvedValue({
    _id: requestId,
    status: "technical_visit_confirmed",
  });
  mocks.availableDateFindOneAndUpdate.mockResolvedValue({
    _id: availableDateId,
  });
});

describe("fluxo de visita técnica da collection request", () => {
  it("aceita com needsTechnicalVisit=true e vai para awaiting_technical_visit", async () => {
    const request = {
      _id: requestId,
      institutionId: "institution-a",
      requestedDates: [{ availableDateId: availableDateId }],
    };
    prepareAcceptRequest(request);

    await acceptCollectionRequest(
      requestId,
      availableDateId,
      slotId,
      changedByUserId,
      bloodBanksLocationId,
      true
    );

    const update = mocks.collectionRequestFindOneAndUpdate.mock.calls[0][1];
    expect(update.$set.status).toBe("awaiting_technical_visit");
    expect(update.$push.statusHistory).toMatchObject({
      status: "awaiting_technical_visit",
      changedBy: changedByUserId,
    });
    expect(mocks.collectionRequestStartSession).toHaveBeenCalledOnce();
    expect(mocks.session.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.session.commitTransaction).toHaveBeenCalledOnce();
    expect(mocks.session.abortTransaction).not.toHaveBeenCalled();
    expect(mocks.availableDateFindOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: availableDateId,
        "slots._id": slotId,
      },
      {
        $set: {
          "slots.$.locked": true,
          "slots.$.lockedBy": requestId,
        },
      },
      { session: mocks.session }
    );
    expect(
      mocks.collectionRequestFindOneAndUpdate.mock.calls[0][2]
    ).toEqual({ session: mocks.session });
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId,
      bloodBanksLocationId,
      transition: "awaiting_technical_visit",
    });
  });

  it("aborta a transação quando a atualização da request falha depois do lock", async () => {
    const request = {
      _id: requestId,
      institutionId: "institution-a",
      requestedDates: [{ availableDateId: availableDateId }],
    };
    const failure = new Error("request update failed");
    prepareAcceptRequest(request);
    mocks.collectionRequestFindOneAndUpdate.mockRejectedValueOnce(failure);

    await expect(
      acceptCollectionRequest(
        requestId,
        availableDateId,
        slotId,
        changedByUserId,
        bloodBanksLocationId
      )
    ).rejects.toBe(failure);

    expect(mocks.availableDateFindOneAndUpdate).toHaveBeenCalledOnce();
    expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledOnce();
    expect(mocks.session.withTransaction).toHaveBeenCalledOnce();
    expect(mocks.session.commitTransaction).not.toHaveBeenCalled();
    expect(mocks.session.abortTransaction).toHaveBeenCalledOnce();
    expect(mocks.session.endSession).toHaveBeenCalledOnce();
    expect(mocks.notifyCollectionRequestStatusTransition).not.toHaveBeenCalled();
  });

  it("reutiliza uma visita aprovada e confirma a solicitação", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue(awaitingRequest);
    mocks.getTechnicalVisitById.mockResolvedValue({
      _id: "visit-approved",
      bloodBanksLocationId,
      outcome: "approved",
    });

    await reuseTechnicalVisit(requestId, {
      technicalVisitId: "visit-approved",
      bloodBanksLocationId,
      changedByUserId,
    });

    expect(mocks.getTechnicalVisitById).toHaveBeenCalledWith(
      bloodBanksLocationId,
      "visit-approved"
    );
    const update = mocks.collectionRequestFindOneAndUpdate.mock.calls[0][1];
    expect(update.$set).toEqual({
      technicalVisitId: "visit-approved",
      status: "technical_visit_confirmed",
    });
    expect(update.$push.statusHistory).toMatchObject({
      status: "technical_visit_confirmed",
      changedBy: changedByUserId,
    });
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId,
      bloodBanksLocationId,
      transition: "technical_visit_confirmed",
    });
  });

  it("rejeita reutilização de visita não aprovada", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue(awaitingRequest);
    mocks.getTechnicalVisitById.mockResolvedValue({
      _id: "visit-pending",
      bloodBanksLocationId,
      outcome: "pending",
    });

    await expect(
      reuseTechnicalVisit(requestId, {
        technicalVisitId: "visit-pending",
        bloodBanksLocationId,
        changedByUserId,
      })
    ).rejects.toThrow("must be approved");
    expect(mocks.collectionRequestFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejeita reutilização de visita pertencente a outro banco", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue(awaitingRequest);
    mocks.getTechnicalVisitById.mockResolvedValue(null);

    await expect(
      reuseTechnicalVisit(requestId, {
        technicalVisitId: "visit-other-bank",
        bloodBanksLocationId,
        changedByUserId,
      })
    ).rejects.toThrow("not found");
  });

  it("registra visita retroativa aprovada e confirma a solicitação", async () => {
    const visitDate = new Date("2026-09-10T10:00:00.000Z");
    mocks.collectionRequestFindOne.mockResolvedValue(awaitingRequest);
    mocks.createTechnicalVisit.mockResolvedValue({ _id: "visit-retroactive" });

    await registerRetroactiveVisit(requestId, {
      visitDate,
      note: "Visita realizada antes do registro",
      bloodBanksLocationId,
      changedByUserId,
    });

    expect(mocks.createTechnicalVisit).toHaveBeenCalledWith({
      bloodBanksLocationId,
      institutionId: "institution-a",
      address: "Rua A, 10, Centro, São Paulo - SP, 01000000",
      visitDate,
      outcome: "approved",
      notes: "Visita realizada antes do registro",
      visitedBy: changedByUserId,
      registeredRetroactively: true,
    });
    expect(
      mocks.collectionRequestFindOneAndUpdate.mock.calls[0][1].$set
    ).toMatchObject({
      technicalVisitId: "visit-retroactive",
      status: "technical_visit_confirmed",
    });
  });

  it("agenda nova visita e mantém a solicitação aguardando", async () => {
    const visitDate = new Date("2026-09-12T10:00:00.000Z");
    mocks.collectionRequestFindOne.mockResolvedValue(awaitingRequest);
    mocks.createTechnicalVisit.mockResolvedValue({ _id: "visit-scheduled" });

    await scheduleNewTechnicalVisit(requestId, {
      visitDate,
      bloodBanksLocationId,
      changedByUserId,
    });

    expect(mocks.createTechnicalVisit).toHaveBeenCalledWith({
      bloodBanksLocationId,
      institutionId: "institution-a",
      address: "Rua A, 10, Centro, São Paulo - SP, 01000000",
      visitDate,
      outcome: "pending",
      visitedBy: changedByUserId,
    });
    const update = mocks.collectionRequestFindOneAndUpdate.mock.calls[0][1];
    expect(update.$set).toEqual({
      technicalVisitId: "visit-scheduled",
      status: "awaiting_technical_visit",
    });
    expect(update.$push.statusHistory).toMatchObject({
      status: "awaiting_technical_visit",
    });
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId,
      bloodBanksLocationId,
      transition: "awaiting_technical_visit",
    });
  });

  it("marca a solicitação como scheduled e dispara a notificação", async () => {
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue({
      _id: requestId,
      status: "scheduled",
    });

    await markCollectionRequestScheduled(requestId, {
      bloodBanksLocationId,
      scheduledByUserId: changedByUserId,
      eventSlug: "campanha-setembro",
    });

    expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: requestId,
        bloodBanksLocationId,
        status: { $in: ["accepted", "technical_visit_confirmed"] },
        deletedAt: null,
      },
      expect.objectContaining({
        $set: {
          status: "scheduled",
          eventSlug: "campanha-setembro",
        },
      }),
      { new: true }
    );
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId,
      bloodBanksLocationId,
      transition: "scheduled",
    });
  });
});
