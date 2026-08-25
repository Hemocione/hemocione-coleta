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
});

afterAll(() => {
  vi.unstubAllGlobals();
});
