import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptCollectionRequest: vi.fn(),
  getBloodBankByBloodBanksLocationId: vi.fn(),
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  sendWhatsAppNotificationToPhone: vi.fn(),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  acceptCollectionRequest: (...args: unknown[]) =>
    mocks.acceptCollectionRequest(...args),
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

const acceptedRequest = {
  _id: requestId,
  accessToken: "tracking-token",
  host: { phone: "5511999999999" },
  availableSlotOptions: [
    {
      slotId: "slot-a",
      date: "2026-09-10",
      startTime: new Date("2026-09-10T12:00:00.000Z"),
    },
  ],
};

function makeEvent(): FakeEvent {
  return {
    context: {
      auth: { user: { id: userId } },
      params: { bloodbanksLocationId: bloodBanksLocationId, requestId },
    },
    body: {
      selectedAvailableDateId: "available-date-a",
      selectedSlotId: "slot-a",
      needsTechnicalVisit: false,
    },
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
    "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/accept.post"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.acceptCollectionRequest.mockResolvedValue(acceptedRequest);
  mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
    name: "Banco A",
  });
  mocks.sendWhatsAppNotificationToPhone.mockResolvedValue(true);
});

describe("POST /api/v1/bloodbank/:bloodbanksLocationId/collection-requests/:requestId/accept", () => {
  it("aguarda a tentativa de WhatsApp antes de responder", async () => {
    let resolveNotification!: (value: boolean) => void;
    const notificationPromise = new Promise<boolean>((resolve) => {
      resolveNotification = resolve;
    });
    mocks.sendWhatsAppNotificationToPhone.mockReturnValue(notificationPromise);

    let settled = false;
    const responsePromise = handler(makeEvent()).then((response) => {
      settled = true;
      return response;
    });

    await vi.waitFor(() => {
      expect(mocks.sendWhatsAppNotificationToPhone).toHaveBeenCalled();
    });
    expect(settled).toBe(false);

    resolveNotification(true);

    await expect(responsePromise).resolves.toEqual({
      success: true,
      data: acceptedRequest,
      message: "Collection request accepted successfully",
    });
    expect(mocks.sendWhatsAppNotificationToPhone).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ confirmedDate: "10/09/2026" }),
      })
    );
  });

  it.each([
    { label: "retorna false", result: false },
    { label: "rejeita com erro da API", result: new Error("API indisponível") },
  ])("não converte falha de entrega em erro da solicitação quando $label", async ({ result }) => {
    if (result instanceof Error) {
      mocks.sendWhatsAppNotificationToPhone.mockRejectedValue(result);
    } else {
      mocks.sendWhatsAppNotificationToPhone.mockResolvedValue(result);
    }
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(handler(makeEvent())).resolves.toEqual({
      success: true,
      data: acceptedRequest,
      message: "Collection request accepted successfully",
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Collection request acceptance notification"),
      expect.anything()
    );
    errorSpy.mockRestore();
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
