import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCollectionRequest: vi.fn(),
  getBloodBankLastAcceptorUserId: vi.fn(),
  getBloodBankByBloodBanksLocationId: vi.fn(),
  sendWhatsAppNotification: vi.fn(),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  createCollectionRequest: (...args: unknown[]) =>
    mocks.createCollectionRequest(...args),
  getBloodBankLastAcceptorUserId: (...args: unknown[]) =>
    mocks.getBloodBankLastAcceptorUserId(...args),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBankByBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/notification", () => ({
  sendWhatsAppNotification: (...args: unknown[]) =>
    mocks.sendWhatsAppNotification(...args),
}));

interface FakeEvent {
  context: {
    params: Record<string, string>;
    auth?: { user?: { id: string } };
  };
  body: unknown;
}

const institutionId = "institution-a";
const bloodBanksLocationId = "blood-bank-a";
const userId = "user-a";

const validBody = {
  bloodBanksLocationId,
  requestedDates: [{ availableDateId: "available-date-a" }],
  host: {
    name: "Fulano de Tal",
    email: "fulano@example.com",
    phone: "11999999999",
  },
};

function makeEvent(body: unknown, authedUserId: string | null = userId): FakeEvent {
  return {
    context: {
      params: { institutionId },
      auth: authedUserId ? { user: { id: authedUserId } } : undefined,
    },
    body,
  };
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name]
  );
  vi.stubGlobal("readBody", (event: FakeEvent) => event.body);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );

  const mod = await import(
    "~/server/api/v1/institutions/[institutionId]/collection-requests/index.post"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  vi.stubEnv("NUXT_PUBLIC_BASE_URL", "https://coleta.hemocione.com.br");
  mocks.createCollectionRequest.mockReset();
  mocks.getBloodBankLastAcceptorUserId.mockReset();
  mocks.getBloodBankByBloodBanksLocationId.mockReset();
  mocks.sendWhatsAppNotification.mockReset();

  mocks.createCollectionRequest.mockResolvedValue({
    _id: "request-a",
    accessToken: "token-a",
    institutionName: "Instituição A",
    availableSlotOptions: [],
  });
  mocks.getBloodBankLastAcceptorUserId.mockResolvedValue(null);
  mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
    name: "Banco A",
    slug: "banco-a",
  });
});

describe("POST /api/v1/institutions/:institutionId/collection-requests", () => {
  it("repassa a note informada ao service", async () => {
    await handler(
      makeEvent({
        ...validBody,
        note: "Evento com mais de um dia de coleta",
      })
    );

    expect(mocks.createCollectionRequest).toHaveBeenCalledWith(
      bloodBanksLocationId,
      expect.objectContaining({
        institutionId,
        requestedByUserId: userId,
        note: "Evento com mais de um dia de coleta",
      })
    );
  });

  it("cria a solicitação sem note quando ela não é informada", async () => {
    await handler(makeEvent({ ...validBody }));

    expect(mocks.createCollectionRequest).toHaveBeenCalledWith(
      bloodBanksLocationId,
      expect.objectContaining({ note: undefined })
    );
  });

  it("repassa slotIds e o intervalo escolhido por data", async () => {
    await handler(
      makeEvent({
        ...validBody,
        requestedDates: [
          {
            availableDateId: "available-date-a",
            slotIds: ["slot-a", "slot-b"],
            startTime: "08:00",
            endTime: "10:00",
            priority: 1,
          },
        ],
      })
    );

    expect(mocks.createCollectionRequest).toHaveBeenCalledWith(
      bloodBanksLocationId,
      expect.objectContaining({
        requestedDates: [
          {
            availableDateId: "available-date-a",
            slotIds: ["slot-a", "slot-b"],
            startTime: "08:00",
            endTime: "10:00",
            priority: 1,
          },
        ],
      })
    );
  });

  it("rejeita quando a note excede o tamanho máximo permitido", async () => {
    await expect(
      handler(
        makeEvent({
          ...validBody,
          note: "a".repeat(501),
        })
      )
    ).rejects.toThrow();

    expect(mocks.createCollectionRequest).not.toHaveBeenCalled();
  });

  it("aguarda a tentativa de notificação de criação e usa todas as datas solicitadas", async () => {
    let resolveNotification!: (value: boolean) => void;
    const notificationPromise = new Promise<boolean>((resolve) => {
      resolveNotification = resolve;
    });

    mocks.getBloodBankLastAcceptorUserId.mockResolvedValue("blood-bank-user");
    mocks.createCollectionRequest.mockResolvedValue({
      _id: "request-a",
      accessToken: "token-a",
      institutionName: "Instituição A",
      availableSlotOptions: [
        { date: "2026-09-10", isRequested: true },
        { date: "2026-09-11", isRequested: true },
      ],
    });
    mocks.sendWhatsAppNotification.mockReturnValue(notificationPromise);

    let settled = false;
    const responsePromise = handler(
      makeEvent({
        ...validBody,
        requestedDates: [
          { availableDateId: "available-date-a" },
          { availableDateId: "available-date-b" },
        ],
      })
    ).then((response) => {
      settled = true;
      return response;
    });

    await vi.waitFor(() => {
      expect(mocks.sendWhatsAppNotification).toHaveBeenCalled();
    });
    expect(settled).toBe(false);

    resolveNotification(true);

    await expect(responsePromise).resolves.toEqual({
      success: true,
      data: { accessToken: "token-a" },
    });
    expect(mocks.sendWhatsAppNotification).toHaveBeenCalledWith({
      userId: "blood-bank-user",
      templateName: "collection_request_created",
      params: {
        bloodBankName: "Banco A",
        institutionName: "Instituição A",
        requestedDates: "10/09/2026, 11/09/2026",
        backofficeUrl: "https://coleta.hemocione.com.br/banco-a/coletas/request-a",
      },
    });
  });

  it("mantém a criação bem-sucedida quando a notificação retorna false", async () => {
    mocks.getBloodBankLastAcceptorUserId.mockResolvedValue("blood-bank-user");
    mocks.sendWhatsAppNotification.mockResolvedValue(false);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(handler(makeEvent(validBody))).resolves.toEqual({
      success: true,
      data: { accessToken: "token-a" },
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Collection request created notification"),
      expect.anything()
    );
    errorSpy.mockRestore();
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
