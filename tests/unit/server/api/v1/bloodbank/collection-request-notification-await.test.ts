import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rejectCollectionRequest: vi.fn(),
  cancelCollectionRequest: vi.fn(),
  getBloodBankByBloodBanksLocationId: vi.fn(),
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  sendWhatsAppNotificationToPhone: vi.fn(),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  rejectCollectionRequest: (...args: unknown[]) =>
    mocks.rejectCollectionRequest(...args),
  cancelCollectionRequest: (...args: unknown[]) =>
    mocks.cancelCollectionRequest(...args),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBankByBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/notification", () => ({
  sendWhatsAppNotificationToPhone: (...args: unknown[]) =>
    mocks.sendWhatsAppNotificationToPhone(...args),
}));

interface FakeEvent {
  context: {
    auth: { user: { id: string } };
    params: Record<string, string>;
  };
  body: Record<string, unknown>;
}

const bloodBanksLocationId = "blood-bank-a";
const requestId = "request-a";
const userId = "blood-bank-user";
const updatedRequest = {
  _id: requestId,
  host: { name: "Pessoa responsável", phone: "5511999999999" },
};

function makeEvent(body: Record<string, unknown>): FakeEvent {
  return {
    context: {
      auth: { user: { id: userId } },
      params: { bloodbanksLocationId: bloodBanksLocationId, requestId },
    },
    body,
  };
}

let rejectHandler: (event: FakeEvent) => Promise<unknown>;
let cancelHandler: (event: FakeEvent) => Promise<unknown>;

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

  const [rejectModule, cancelModule] = await Promise.all([
    import(
      "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/reject.post"
    ),
    import(
      "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/cancel.post"
    ),
  ]);
  rejectHandler = rejectModule.default as (event: FakeEvent) => Promise<unknown>;
  cancelHandler = cancelModule.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.rejectCollectionRequest.mockResolvedValue(updatedRequest);
  mocks.cancelCollectionRequest.mockResolvedValue(updatedRequest);
  mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
    name: "Banco A",
  });
  mocks.sendWhatsAppNotificationToPhone.mockResolvedValue(true);
});

describe("notificações de rejeição e cancelamento", () => {
  it.each([
    {
      label: "rejeição",
      handler: () => rejectHandler(makeEvent({ rejectionReason: "Sem agenda" })),
      serviceMock: mocks.rejectCollectionRequest,
    },
    {
      label: "cancelamento",
      handler: () =>
        cancelHandler(makeEvent({ cancellationReason: "Evento cancelado" })),
      serviceMock: mocks.cancelCollectionRequest,
    },
  ])("aguarda a entrega do WhatsApp antes de responder: $label", async ({
    handler,
    serviceMock,
  }) => {
    serviceMock.mockResolvedValue(updatedRequest);
    let resolveNotification!: (value: boolean) => void;
    const notificationPromise = new Promise<boolean>((resolve) => {
      resolveNotification = resolve;
    });
    mocks.sendWhatsAppNotificationToPhone.mockReturnValue(notificationPromise);

    let settled = false;
    const responsePromise = handler().then((response) => {
      settled = true;
      return response;
    });

    await vi.waitFor(() => {
      expect(mocks.sendWhatsAppNotificationToPhone).toHaveBeenCalled();
    });
    expect(settled).toBe(false);

    resolveNotification(true);

    await expect(responsePromise).resolves.toEqual(
      expect.objectContaining({ success: true })
    );
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
