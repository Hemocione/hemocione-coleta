import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSecretAuth: vi.fn(),
  proposeTechnicalVisit: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertSecretAuth: (...args: unknown[]) => mocks.assertSecretAuth(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  proposeTechnicalVisit: (...args: unknown[]) =>
    mocks.proposeTechnicalVisit(...args),
}));

interface FakeEvent {
  context: { params: Record<string, string> };
  body: unknown;
}

type Handler = (event: FakeEvent) => Promise<unknown>;

const bloodBanksLocationId = "blood-bank-a";
const requestId = "request-a";
const actingAsStaffId = "staff-a";

let handler: Handler;

function makeEvent(body: unknown): FakeEvent {
  return {
    context: { params: { bloodbanksLocationId: bloodBanksLocationId, requestId } },
    body,
  };
}

const validBody = {
  actingAsStaffId,
  proposedDates: [
    {
      date: "2026-09-10T00:00:00.000Z",
      startTime: "09:00",
      durationMinutes: 60,
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
    "~/server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/collection-requests/[requestId]/propose-technical-visit.post"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  mocks.assertSecretAuth.mockReset();
  mocks.proposeTechnicalVisit.mockReset();
  mocks.proposeTechnicalVisit.mockResolvedValue({
    _id: requestId,
    status: "awaiting_technical_visit",
  });
});

describe("POST backoffice propose-technical-visit", () => {
  it("usa secret auth e passa actingAsStaffId e o escopo ao service", async () => {
    const event = makeEvent(validBody);
    const response = await handler(event);

    expect(response).toEqual({
      success: true,
      data: { _id: requestId, status: "awaiting_technical_visit" },
      message: "Technical visit proposal created successfully",
    });
    expect(mocks.assertSecretAuth).toHaveBeenCalledWith(event);
    expect(mocks.proposeTechnicalVisit).toHaveBeenCalledWith(
      requestId,
      {
        proposedDates: [
          {
            date: new Date("2026-09-10T00:00:00.000Z"),
            startTime: "09:00",
            durationMinutes: 60,
            note: "Chegar 15 minutos antes",
          },
        ],
        note: "Escolha uma das opções para a visita técnica",
        proposedBy: actingAsStaffId,
      },
      bloodBanksLocationId
    );
  });

  it("retorna 400 para body inválido", async () => {
    await expect(
      handler(makeEvent({ ...validBody, actingAsStaffId: undefined }))
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.proposeTechnicalVisit).not.toHaveBeenCalled();
  });

  it("preserva 401 do secret auth", async () => {
    mocks.assertSecretAuth.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(handler(makeEvent(validBody))).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mocks.proposeTechnicalVisit).not.toHaveBeenCalled();
  });
});
