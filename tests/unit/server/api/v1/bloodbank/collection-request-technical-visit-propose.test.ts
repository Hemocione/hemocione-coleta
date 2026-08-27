import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  proposeTechnicalVisit: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  proposeTechnicalVisit: (...args: unknown[]) =>
    mocks.proposeTechnicalVisit(...args),
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
      endTime: "10:00",
      note: "Chegar 15 minutos antes",
    },
  ],
  note: "Escolha uma das opções para a visita técnica",
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
    "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/propose-technical-visit.post"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  mocks.assertUserAccessToBloodBanksLocationId.mockReset();
  mocks.proposeTechnicalVisit.mockReset();
  mocks.proposeTechnicalVisit.mockResolvedValue({
    _id: requestId,
    status: "awaiting_technical_visit",
  });
});

describe("POST self-service propose-technical-visit", () => {
  it("envia a proposta autenticada e repassa o escopo do banco ao service", async () => {
    const response = await handler(makeEvent(validBody));

    expect(response).toEqual({
      success: true,
      data: { _id: requestId, status: "awaiting_technical_visit" },
      message: "Technical visit proposal created successfully",
    });
    expect(mocks.assertUserAccessToBloodBanksLocationId).toHaveBeenCalledWith(
      { id: userId },
      bloodBanksLocationId
    );
    expect(mocks.proposeTechnicalVisit).toHaveBeenCalledWith(
      requestId,
      {
        proposedDates: [
          {
            date: new Date("2026-09-10T00:00:00.000Z"),
            startTime: "09:00",
            endTime: "10:00",
            durationMinutes: 60,
            note: "Chegar 15 minutos antes",
          },
        ],
        note: "Escolha uma das opções para a visita técnica",
        proposedBy: userId,
      },
      bloodBanksLocationId
    );
  });

  it("retorna 403 quando o usuário não tem acesso ao banco", async () => {
    mocks.assertUserAccessToBloodBanksLocationId.mockImplementation(() => {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    });

    await expect(handler(makeEvent(validBody))).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.proposeTechnicalVisit).not.toHaveBeenCalled();
  });

  it("retorna 400 para body inválido", async () => {
    await expect(
      handler(makeEvent({ ...validBody, proposedDates: [] }))
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.proposeTechnicalVisit).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o horário final não é posterior ao inicial", async () => {
    await expect(
      handler(
        makeEvent({
          ...validBody,
          proposedDates: [{ ...validBody.proposedDates[0], endTime: "08:59" }],
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.proposeTechnicalVisit).not.toHaveBeenCalled();
  });
});
