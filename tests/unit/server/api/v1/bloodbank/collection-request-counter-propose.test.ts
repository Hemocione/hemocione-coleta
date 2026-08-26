import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  counterPropose: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  counterPropose: (...args: unknown[]) => mocks.counterPropose(...args),
}));

interface FakeEvent {
  context: {
    auth: { user: { id: string } };
    params: Record<string, string>;
  };
  body: unknown;
}

type Handler = (event: FakeEvent) => Promise<unknown>;

const bloodBanksLocationId = "blood-bank-a";
const requestId = "request-a";
const userId = "blood-bank-user";

let handler: Handler;

function makeEvent(body: unknown): FakeEvent {
  return {
    context: {
      auth: { user: { id: userId } },
      params: { bloodbanksLocationId: bloodBanksLocationId, requestId },
    },
    body,
  };
}

const validBody = {
  proposedDates: [
    {
      date: "2026-09-10T00:00:00.000Z",
      startTime: "09:00",
      durationMinutes: 60,
      note: "Horário alternativo",
    },
  ],
  needsTechnicalVisit: false,
  note: "Podemos atender nesta data",
};

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
    "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/counter-propose.post"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  mocks.assertUserAccessToBloodBanksLocationId.mockReset();
  mocks.counterPropose.mockReset();
  mocks.counterPropose.mockResolvedValue({ _id: requestId, status: "counter_proposed" });
});

describe("POST self-service counter-propose", () => {
  it("envia contraproposta autenticada por JWT e usa o id do usuário como proposedBy", async () => {
    const response = await handler(makeEvent(validBody));

    expect(response).toEqual({
      success: true,
      data: { _id: requestId, status: "counter_proposed" },
      message: "Counter proposal created successfully",
    });
    expect(mocks.assertUserAccessToBloodBanksLocationId).toHaveBeenCalledWith(
      { id: userId },
      bloodBanksLocationId
    );
    expect(mocks.counterPropose).toHaveBeenCalledWith(
      requestId,
      {
        proposedDates: [
          {
            date: new Date("2026-09-10T00:00:00.000Z"),
            startTime: "09:00",
            durationMinutes: 60,
            note: "Horário alternativo",
          },
        ],
        needsTechnicalVisit: false,
        note: "Podemos atender nesta data",
        proposedBy: userId,
      },
      bloodBanksLocationId
    );
  });

  it("retorna 400 quando proposedDates está vazio", async () => {
    await expect(
      handler(makeEvent({ ...validBody, proposedDates: [] }))
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.counterPropose).not.toHaveBeenCalled();
  });

  it("propaga erro de permissão do guard de bloodbank", async () => {
    mocks.assertUserAccessToBloodBanksLocationId.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    });

    await expect(handler(makeEvent(validBody))).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.counterPropose).not.toHaveBeenCalled();
  });

  it("propaga erro de negócio do service (ex: já existe contraproposta)", async () => {
    mocks.counterPropose.mockRejectedValue(
      new Error("Request not found, not in pending status, or already has a counter proposal")
    );

    await expect(handler(makeEvent(validBody))).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
