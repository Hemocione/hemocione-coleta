import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyCollectionRequestStatusTransition } from "~/server/services/collectionRequestNotification";

const mocks = vi.hoisted(() => ({
  collectionRequestFindOne: vi.fn(),
  bloodBankFindOne: vi.fn(),
  getInstitutionsByIds: vi.fn(),
  sendWhatsAppNotification: vi.fn(),
  sendWhatsAppNotificationToPhone: vi.fn(),
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
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.bloodBankFindOne(...args),
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionsByIds: (...args: unknown[]) =>
    mocks.getInstitutionsByIds(...args),
}));

vi.mock("~/server/services/notification", () => ({
  sendWhatsAppNotification: (...args: unknown[]) =>
    mocks.sendWhatsAppNotification(...args),
  sendWhatsAppNotificationToPhone: (...args: unknown[]) =>
    mocks.sendWhatsAppNotificationToPhone(...args),
}));

const requestId = "request-a";
const bloodBanksLocationId = "blood-bank-a";
const request = {
  _id: requestId,
  institutionId: "institution-a",
  requestedByUserId: "institution-user",
  host: { name: "Pessoa responsável", phone: "5511999999999" },
  accessToken: "tracking-token",
  counterProposal: {
    proposedDates: [
      {
        date: new Date("2026-09-10T00:00:00.000Z"),
        startTime: "08:30",
      },
    ],
  },
  confirmedSchedule: {
    date: new Date("2026-09-12T00:00:00.000Z"),
    startTime: "10:00",
  },
  eventSlug: "campanha-setembro",
};

beforeEach(() => {
  vi.stubEnv("NUXT_PUBLIC_BASE_URL", "https://coleta.hemocione.com.br");
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.collectionRequestFindOne.mockReturnValue({
    lean: async () => request,
  });
  mocks.bloodBankFindOne.mockResolvedValue({ name: "Banco Central" });
  mocks.getInstitutionsByIds.mockResolvedValue([
    { id: "institution-a", name: "Instituto Esperança" },
  ]);
  mocks.sendWhatsAppNotification.mockResolvedValue(true);
  mocks.sendWhatsAppNotificationToPhone.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("notificações das transições de collection request", () => {
  it("notifica a instituição quando uma contraproposta é criada", async () => {
    await notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId,
      transition: "counter_proposed",
    });

    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledWith({
      userId: "institution-user",
      templateName: "collection_request_counter_proposed",
      params: {
        contactName: "Pessoa responsável",
        bloodBankName: "Banco Central",
        proposedDate: "10/09/2026",
        proposedTime: "08:30",
        trackingUrl:
          "https://coleta.hemocione.com.br/agendar/acompanhar/tracking-token",
      },
    });
  });

  it("notifica o banco quando a contraproposta é recusada", async () => {
    await notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId,
      transition: "counter_proposal_declined",
      recipientUserId: "blood-bank-user",
    });

    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledWith({
      userId: "blood-bank-user",
      templateName: "collection_request_counter_proposal_declined",
      params: {
        contactName: "Equipe do banco de sangue",
        institutionName: "Instituto Esperança",
        trackingUrl:
          "https://coleta.hemocione.com.br/agendar/acompanhar/tracking-token",
      },
    });
  });

  it("notifica a instituição enquanto aguarda visita técnica", async () => {
    await notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId,
      transition: "awaiting_technical_visit",
    });

    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledWith({
      userId: "institution-user",
      templateName: "collection_request_awaiting_technical_visit",
      params: {
        contactName: "Pessoa responsável",
        bloodBankName: "Banco Central",
        trackingUrl:
          "https://coleta.hemocione.com.br/agendar/acompanhar/tracking-token",
      },
    });
  });

  it.each([
    { label: "retorna false", result: false },
    { label: "rejeita com erro da API", result: new Error("API indisponível") },
  ])(
    "aguarda e registra a falha da notificação quando $label",
    async ({ result }) => {
      if (result instanceof Error) {
        mocks.sendWhatsAppNotification.mockRejectedValue(result);
      } else {
        mocks.sendWhatsAppNotification.mockResolvedValue(result);
      }
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        notifyCollectionRequestStatusTransition({
          requestId,
          bloodBanksLocationId,
          transition: "awaiting_technical_visit",
        })
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("WhatsApp notification"),
        expect.objectContaining({
          requestId,
          transition: "awaiting_technical_visit",
        })
      );
      errorSpy.mockRestore();
    }
  );

  it("notifica o resultado reprovado da visita técnica", async () => {
    await notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId,
      transition: "technical_visit_verdict",
      technicalVisitResult: "Reprovada",
    });

    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledWith({
      userId: "institution-user",
      templateName: "technical_visit_confirmed",
      params: {
        contactName: "Pessoa responsável",
        bloodBankName: "Banco Central",
        result: "Reprovada",
        trackingUrl:
          "https://coleta.hemocione.com.br/agendar/acompanhar/tracking-token",
      },
    });
  });

  it("notifica instituição e ponto focal quando fica scheduled", async () => {
    await notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId,
      transition: "scheduled",
    });

    const params = {
      contactName: "Pessoa responsável",
      bloodBankName: "Banco Central",
      confirmedDateTime: "12/09/2026 10:00",
      eventLink: "https://eventos.hemocione.com.br/event/campanha-setembro",
    };

    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledWith({
      userId: "institution-user",
      templateName: "collection_request_scheduled",
      params,
    });
    expect(mocks.sendWhatsAppNotificationToPhone).toHaveBeenCalledWith({
      phone: "5511999999999",
      templateName: "collection_request_scheduled",
      params,
    });
  });

  it("usa acompanhamento como fallback quando scheduled ainda não tem eventSlug", async () => {
    mocks.collectionRequestFindOne.mockReturnValue({
      lean: async () => ({ ...request, eventSlug: undefined }),
    });

    await notifyCollectionRequestStatusTransition({
      requestId,
      bloodBanksLocationId,
      transition: "scheduled",
    });

    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          eventLink:
            "https://coleta.hemocione.com.br/agendar/acompanhar/tracking-token",
        }),
      })
    );
  });
});
