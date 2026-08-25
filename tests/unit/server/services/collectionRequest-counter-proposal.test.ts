import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionRequestSchema } from "~/server/models/collectionRequest";
import { TechnicalVisitSchema } from "~/server/models/technicalVisit";
import {
  counterPropose,
  createCollectionRequest,
  respondToCounterProposal,
} from "~/server/services/collectionRequest";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  collectionRequestFindOneAndUpdate: vi.fn(),
  bloodBankFindOne: vi.fn(),
  availableDateFind: vi.fn(),
  notifyCollectionRequestStatusTransition: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
      findOneAndUpdate: (...args: unknown[]) =>
        mocks.collectionRequestFindOneAndUpdate(...args),
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
  commitmentTerm: { CommitmentTerm: {} },
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: vi.fn(),
}));

vi.mock("~/server/services/collectionRequestNotification", () => ({
  notifyCollectionRequestStatusTransition: (...args: unknown[]) =>
    mocks.notifyCollectionRequestStatusTransition(...args),
}));

const proposedDates = [
  {
    date: new Date("2026-09-10T00:00:00.000Z"),
    startTime: "08:30",
    durationMinutes: 45,
    note: "Primeiro horário",
  },
  {
    date: new Date("2026-09-11T00:00:00.000Z"),
    startTime: "14:00",
    durationMinutes: 60,
    note: "Segundo horário",
  },
];

const counterProposal = {
  proposedDates,
  needsTechnicalVisit: false,
  note: "Podemos atender nestes horários",
  proposedBy: "blood-bank-user",
  proposedAt: new Date("2026-08-13T00:00:00.000Z"),
};

const createData = {
  institutionId: "institution-a",
  requestedByUserId: "institution-user",
  requestedDates: [{ availableDateId: "available-date-a" }],
  host: {
    name: "Pessoa responsável",
    email: "pessoa@example.com",
    phone: "11999999999",
  },
};

beforeEach(() => {
  mocks.collectionRequestFindOne.mockReset();
  mocks.collectionRequestFindOneAndUpdate.mockReset();
  mocks.bloodBankFindOne.mockReset();
  mocks.availableDateFind.mockReset();
  mocks.notifyCollectionRequestStatusTransition.mockReset();
});

describe("máquina de estados de contraproposta", () => {
  it("counterPropose cria uma contraproposta apenas para uma solicitação pending sem proposta ativa", async () => {
    const updatedRequest = {
      _id: "request-a",
      status: "counter_proposed",
      bloodBanksLocationId: "blood-bank-a",
    };
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(updatedRequest);

    await expect(
      counterPropose(
        "request-a",
        {
          proposedDates,
          needsTechnicalVisit: false,
          note: counterProposal.note,
          proposedBy: counterProposal.proposedBy,
        },
        "blood-bank-a"
      )
    ).resolves.toEqual(updatedRequest);

    const [query, update, options] =
      mocks.collectionRequestFindOneAndUpdate.mock.calls[0];
    expect(query).toEqual({
      _id: "request-a",
      bloodBanksLocationId: "blood-bank-a",
      status: "pending",
      deletedAt: null,
      counterProposal: { $exists: false },
    });
    expect(update.$set).toMatchObject({
      status: "counter_proposed",
      counterProposal: {
        proposedDates,
        needsTechnicalVisit: false,
        note: counterProposal.note,
        proposedBy: counterProposal.proposedBy,
      },
    });
    expect(update.$set.counterProposal.proposedAt).toBeInstanceOf(Date);
    expect(options).toEqual({ new: true });
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId: "request-a",
      bloodBanksLocationId: "blood-bank-a",
      transition: "counter_proposed",
    });
  });

  it("counterPropose rejeita uma segunda tentativa quando já existe contraproposta", async () => {
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      counterPropose(
        "request-a",
        {
          proposedDates,
          needsTechnicalVisit: false,
          note: "Outra proposta",
          proposedBy: "blood-bank-user",
        },
        "blood-bank-a"
      )
    ).rejects.toThrow("already has a counter proposal");

    expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        bloodBanksLocationId: "blood-bank-a",
        status: "pending",
        counterProposal: { $exists: false },
      }),
      expect.anything(),
      { new: true }
    );
  });

  it("counterPropose rejeita (IDOR) quando a solicitação pertence a outro banco de sangue", async () => {
    // A solicitação é do banco B; o chamador está autorizado só pro banco A.
    // O findOneAndUpdate real não bateria (_id + bloodBanksLocationId=A não
    // casa com um doc gravado com bloodBanksLocationId=B), então o mock
    // reflete esse "não encontrado" retornando null — o teste prova que o
    // filtro enviado ao model inclui o bloodBanksLocationId do chamador.
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      counterPropose(
        "request-do-banco-b",
        {
          proposedDates,
          needsTechnicalVisit: false,
          note: "Tentativa de contraproposta cross-bank",
          proposedBy: "usuario-banco-a",
        },
        "blood-bank-a"
      )
    ).rejects.toThrow(
      "Request not found, not in pending status, or already has a counter proposal"
    );

    expect(mocks.collectionRequestFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "request-do-banco-b",
        bloodBanksLocationId: "blood-bank-a",
      }),
      expect.anything(),
      { new: true }
    );
    expect(mocks.notifyCollectionRequestStatusTransition).not.toHaveBeenCalled();
  });

  it.each([
    "accepted",
    "rejected",
    "cancelled",
    "counter_proposed",
    "awaiting_technical_visit",
    "technical_visit_confirmed",
    "scheduled",
  ])("counterPropose rejeita se o status atual for %s", async (status) => {
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      counterPropose(
        "request-a",
        {
          proposedDates,
          needsTechnicalVisit: false,
          note: "Outra proposta",
          proposedBy: "blood-bank-user",
        },
        "blood-bank-a"
      )
    ).rejects.toThrow();

    expect(mocks.collectionRequestFindOneAndUpdate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: "pending" })
    );
    expect(status).not.toBe("pending");
  });

  it.each([
    { needsTechnicalVisit: false, expectedStatus: "accepted" },
    {
      needsTechnicalVisit: true,
      expectedStatus: "awaiting_technical_visit",
    },
  ])(
    "respondToCounterProposal aceita e vai para $expectedStatus quando needsTechnicalVisit=$needsTechnicalVisit",
    async ({ needsTechnicalVisit, expectedStatus }) => {
      mocks.collectionRequestFindOne.mockResolvedValue({
        _id: "request-a",
        status: "counter_proposed",
        bloodBanksLocationId: "blood-bank-a",
        counterProposal: { ...counterProposal, needsTechnicalVisit },
      });
      mocks.collectionRequestFindOneAndUpdate.mockResolvedValue({
        _id: "request-a",
        status: expectedStatus,
      });

      await respondToCounterProposal("request-a", {
        decision: "accepted",
        selectedDateId: "1",
        respondedBy: "institution-user",
      });

      const [query, update, options] =
        mocks.collectionRequestFindOneAndUpdate.mock.calls[0];
      expect(query).toEqual({
        _id: "request-a",
        status: "counter_proposed",
        deletedAt: null,
        counterProposal: { $exists: true },
      });
      expect(update.$set).toMatchObject({
        status: expectedStatus,
        confirmedSchedule: {
          date: proposedDates[1].date,
          startTime: proposedDates[1].startTime,
          durationMinutes: proposedDates[1].durationMinutes,
        },
      });
      expect(update.$push.previousCounterProposals).toMatchObject({
        ...counterProposal,
        needsTechnicalVisit,
        response: {
          decision: "accepted",
          selectedDateId: "1",
          respondedBy: "institution-user",
        },
      });
      expect(update.$unset).toEqual({ counterProposal: 1 });
      expect(options).toEqual({ new: true });
      if (expectedStatus === "awaiting_technical_visit") {
        expect(
          mocks.notifyCollectionRequestStatusTransition
        ).toHaveBeenCalledWith({
          requestId: "request-a",
          bloodBanksLocationId: "blood-bank-a",
          transition: "awaiting_technical_visit",
        });
      } else {
        expect(mocks.notifyCollectionRequestStatusTransition).not.toHaveBeenCalled();
      }
    }
  );

  it("respondToCounterProposal recusa e vira counter_proposal_declined", async () => {
    mocks.collectionRequestFindOne.mockResolvedValue({
      _id: "request-a",
      status: "counter_proposed",
      bloodBanksLocationId: "blood-bank-a",
      counterProposal,
    });
    mocks.collectionRequestFindOneAndUpdate.mockResolvedValue({
      _id: "request-a",
      status: "counter_proposal_declined",
    });

    await respondToCounterProposal("request-a", {
      decision: "declined",
      selectedDateId: "",
      respondedBy: "institution-user",
    });

    const update = mocks.collectionRequestFindOneAndUpdate.mock.calls[0][1];
    expect(update.$set).toEqual({ status: "counter_proposal_declined" });
    expect(update.$push.previousCounterProposals).toMatchObject({
      ...counterProposal,
      response: {
        decision: "declined",
        selectedDateId: "",
        respondedBy: "institution-user",
      },
    });
    expect(update.$unset).toEqual({ counterProposal: 1 });
    expect(mocks.notifyCollectionRequestStatusTransition).toHaveBeenCalledWith({
      requestId: "request-a",
      bloodBanksLocationId: "blood-bank-a",
      transition: "counter_proposal_declined",
      recipientUserId: "blood-bank-user",
    });
  });
});

describe("guard de duplicidade de solicitações", () => {
  it.each([
    "counter_proposed",
    "awaiting_technical_visit",
    "technical_visit_confirmed",
    "accepted",
  ])(
    "bloqueia nova solicitação quando já existe uma com status %s",
    async (status) => {
      mocks.bloodBankFindOne.mockResolvedValue({ active: true });
      mocks.collectionRequestFindOne.mockResolvedValue({ status });

      await expect(
        createCollectionRequest("blood-bank-a", createData)
      ).rejects.toThrow("já possui uma solicitação em aberto");

      expect(mocks.collectionRequestFindOne).toHaveBeenCalledWith({
        institutionId: "institution-a",
        bloodBanksLocationId: "blood-bank-a",
        status: {
          $in: [
            "pending",
            "counter_proposed",
            "awaiting_technical_visit",
            "technical_visit_confirmed",
            "accepted",
          ],
        },
        deletedAt: null,
      });
    }
  );
});

describe("schema de CollectionRequest", () => {
  it("expõe os campos da contraproposta e todos os novos estados", () => {
    expect(CollectionRequestSchema.path("note")).toBeDefined();
    expect(CollectionRequestSchema.path("technicalVisitId").options.ref).toBe(
      "TechnicalVisit"
    );
    expect(
      CollectionRequestSchema.path("requestedDates").schema.path("startTime")
    ).toBeDefined();
    expect(CollectionRequestSchema.path("counterProposal")).toBeDefined();
    expect(
      CollectionRequestSchema.path("previousCounterProposals")
    ).toBeDefined();
    expect(CollectionRequestSchema.path("confirmedSchedule")).toBeDefined();
    expect(CollectionRequestSchema.path("eventSlug")).toBeDefined();
    expect(CollectionRequestSchema.path("status").options.enum).toEqual(
      expect.arrayContaining([
        "counter_proposed",
        "counter_proposal_declined",
        "awaiting_technical_visit",
        "technical_visit_confirmed",
        "scheduled",
      ])
    );
    expect(TechnicalVisitSchema.path("registeredRetroactively")).toBeDefined();
  });
});
