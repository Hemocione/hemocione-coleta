import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  getCollectionRequestById: vi.fn(),
  getBloodBankByBloodBanksLocationId: vi.fn(),
  markCollectionRequestScheduled: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  getCollectionRequestById: (...args: unknown[]) =>
    mocks.getCollectionRequestById(...args),
  markCollectionRequestScheduled: (...args: unknown[]) =>
    mocks.markCollectionRequestScheduled(...args),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBankByBloodBanksLocationId(...args),
}));

interface FakeEvent {
  context: {
    auth: { user: { id: string } };
    params: Record<string, string>;
  };
}

const bloodBanksLocationId = "blood-bank-a";
const requestId = "request-a";
const userId = "blood-bank-user";
const config = {
  hemocioneDigitalEventUrl: "https://events.example.test/",
  coletaIntegrationSecret: "coleta-secret",
};

function makeEvent(): FakeEvent {
  return {
    context: {
      auth: { user: { id: userId } },
      params: { bloodbanksLocationId: bloodBanksLocationId, requestId },
    },
  };
}

function makeRequest(status = "accepted") {
  return {
    _id: requestId,
    status,
    institutionId: "institution-a",
    bloodBanksLocationId,
    institutionName: "Instituição A",
    address: {
      street: "Rua das Flores",
      number: "100",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zipCode: "01000000",
    },
    confirmedSchedule: {
      date: new Date("2026-09-20T00:00:00.000Z"),
      startTime: "09:30",
      durationMinutes: 90,
    },
    availableSlotOptions: [],
  };
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name]
  );
  vi.stubGlobal("useRuntimeConfig", () => config);
  vi.stubGlobal("$fetch", mocks.fetch);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );

  const mod = await import(
    "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/generate-event-link.post"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getCollectionRequestById.mockResolvedValue(makeRequest());
  mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
    name: "Banco A",
  });
  mocks.markCollectionRequestScheduled.mockResolvedValue({
    _id: requestId,
    status: "scheduled",
    eventSlug: "coleta-institution-a",
  });
  mocks.fetch.mockResolvedValue({ slug: "coleta-institution-a" });
});

describe("POST /api/v1/bloodbank/:bloodBanksLocationId/collection-requests/:requestId/generate-event-link", () => {
  it("cria o evento, grava o slug e agenda a solicitação", async () => {
    const response = await handler(makeEvent());

    expect(response).toEqual({
      success: true,
      data: {
        _id: requestId,
        status: "scheduled",
        eventSlug: "coleta-institution-a",
      },
      eventSlug: "coleta-institution-a",
      message: "Event registration link generated successfully",
    });
    expect(mocks.assertUserAccessToBloodBanksLocationId).toHaveBeenCalledWith(
      { id: userId },
      bloodBanksLocationId
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://events.example.test/api/backoffice/v1/event",
      {
        method: "POST",
        headers: { "x-coleta-integration-secret": "coleta-secret" },
        body: {
          sourceCollectionRequestId: requestId,
          name: "Coleta — Banco A",
          startAt: "2026-09-20T09:30:00.000Z",
          endAt: "2026-09-20T11:00:00.000Z",
          location: {
            address: "Rua das Flores, 100, Centro, 01000000",
            city: "São Paulo",
            state: "SP",
          },
          bloodBanksLocationId,
          institutionId: "institution-a",
        },
      }
    );
    expect(mocks.markCollectionRequestScheduled).toHaveBeenCalledWith(
      requestId,
      {
        bloodBanksLocationId,
        eventSlug: "coleta-institution-a",
        scheduledByUserId: userId,
      }
    );
  });

  it("permite uma solicitação technical_visit_confirmed", async () => {
    mocks.getCollectionRequestById.mockResolvedValue(
      makeRequest("technical_visit_confirmed")
    );

    await handler(makeEvent());

    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.markCollectionRequestScheduled).toHaveBeenCalledOnce();
  });

  it("retorna 400 para status que não pode gerar evento", async () => {
    mocks.getCollectionRequestById.mockResolvedValue(makeRequest("pending"));

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.markCollectionRequestScheduled).not.toHaveBeenCalled();
  });

  it("retorna 403 quando o usuário não tem acesso ao banco", async () => {
    mocks.assertUserAccessToBloodBanksLocationId.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    });

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.getCollectionRequestById).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("propaga a falha do digital-event e não marca a solicitação", async () => {
    const upstreamError = Object.assign(new Error("Digital event unavailable"), {
      statusCode: 503,
    });
    mocks.fetch.mockRejectedValue(upstreamError);

    await expect(handler(makeEvent())).rejects.toBe(upstreamError);
    expect(mocks.markCollectionRequestScheduled).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
