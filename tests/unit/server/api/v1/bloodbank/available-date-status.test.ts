import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  updateAvailableDateStatus: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/availableDate", () => ({
  updateAvailableDateStatus: (...args: unknown[]) =>
    mocks.updateAvailableDateStatus(...args),
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
const availableDateId = "date-a";
const userId = "blood-bank-user";

let handler: Handler;

function makeEvent(body: unknown): FakeEvent {
  return {
    context: {
      auth: { user: { id: userId } },
      params: { bloodbanksLocationId: bloodBanksLocationId, availableDateId },
    },
    body,
  };
}

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
    "~/server/api/v1/bloodbank/[bloodbanksLocationId]/available-dates/[availableDateId].patch"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  mocks.assertUserAccessToBloodBanksLocationId.mockReset();
  mocks.updateAvailableDateStatus.mockReset();
  mocks.updateAvailableDateStatus.mockResolvedValue({
    _id: availableDateId,
    bloodBanksLocationId,
    date: "2999-01-15",
    year: 2999,
    isAllTeams: false,
    status: "blocked",
    slots: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

describe("PATCH available date status", () => {
  it.each(["blocked", "pending", "released"] as const)(
    "atualiza o status para %s com permissão verificada",
    async (status) => {
      const response = await handler(makeEvent({ status }));

      expect(response).toMatchObject({
        success: true,
        data: { _id: availableDateId, status: "blocked" },
      });
      expect(mocks.assertUserAccessToBloodBanksLocationId).toHaveBeenCalledWith(
        { id: userId },
        bloodBanksLocationId
      );
      expect(mocks.updateAvailableDateStatus).toHaveBeenCalledWith(
        availableDateId,
        bloodBanksLocationId,
        status
      );
    }
  );

  it("retorna 400 quando status está ausente ou fora do enum", async () => {
    await expect(handler(makeEvent({}))).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(handler(makeEvent({ status: "arquivada" }))).rejects.toMatchObject(
      { statusCode: 400 }
    );
    expect(mocks.updateAvailableDateStatus).not.toHaveBeenCalled();
  });

  it("retorna 400 quando bloodbanksLocationId está ausente", async () => {
    const event = makeEvent({ status: "blocked" });
    event.context.params.bloodbanksLocationId = "";

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.updateAvailableDateStatus).not.toHaveBeenCalled();
  });

  it("propaga erro de permissão do guard de bloodbank", async () => {
    mocks.assertUserAccessToBloodBanksLocationId.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    });

    await expect(handler(makeEvent({ status: "blocked" }))).rejects.toMatchObject(
      { statusCode: 403 }
    );
    expect(mocks.updateAvailableDateStatus).not.toHaveBeenCalled();
  });

  it("retorna 404 quando a data não pertence ao banco de sangue", async () => {
    mocks.updateAvailableDateStatus.mockResolvedValue(null);

    await expect(handler(makeEvent({ status: "blocked" }))).rejects.toMatchObject(
      { statusCode: 404 }
    );
  });

  it("mapeia erro genérico do service para 500", async () => {
    mocks.updateAvailableDateStatus.mockRejectedValue(new Error("db down"));

    await expect(handler(makeEvent({ status: "pending" }))).rejects.toMatchObject(
      { statusCode: 500 }
    );
  });
});
