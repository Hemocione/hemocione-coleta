import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSecretAuth: vi.fn(),
  acceptCollectionRequest: vi.fn(),
  rejectCollectionRequest: vi.fn(),
  cancelCollectionRequest: vi.fn(),
  counterPropose: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertSecretAuth: (...args: unknown[]) => mocks.assertSecretAuth(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  acceptCollectionRequest: (...args: unknown[]) =>
    mocks.acceptCollectionRequest(...args),
  rejectCollectionRequest: (...args: unknown[]) =>
    mocks.rejectCollectionRequest(...args),
  cancelCollectionRequest: (...args: unknown[]) =>
    mocks.cancelCollectionRequest(...args),
  counterPropose: (...args: unknown[]) => mocks.counterPropose(...args),
}));

interface FakeEvent {
  context: {
    params: Record<string, string>;
  };
  body: unknown;
  headers: {
    get: (name: string) => string | null;
  };
}

type Handler = (event: FakeEvent) => Promise<unknown>;
type Action = "accept" | "reject" | "cancel" | "counterPropose";

const bloodBanksLocationId = "blood-bank-a";
const requestId = "request-a";
const actingAsStaffId = "staff-user-a";

const handlers = {} as Record<Action, Handler>;

function makeEvent(
  body: unknown,
  headers: Record<string, string> = { "x-secret": "valid-secret" }
): FakeEvent {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value])
  );

  return {
    context: {
      params: { bloodbanksLocationId: bloodBanksLocationId, requestId },
    },
    body,
    headers: {
      get: (name: string) => normalizedHeaders[name.toLowerCase()] ?? null,
    },
  };
}

const validBodies: Record<Action, Record<string, unknown>> = {
  accept: {
    actingAsStaffId,
    selectedAvailableDateId: "available-date-a",
    selectedSlotId: "slot-a",
    needsTechnicalVisit: false,
  },
  reject: {
    actingAsStaffId,
    rejectionReason: "Data indisponível",
  },
  cancel: {
    actingAsStaffId,
    cancellationReason: "Cancelamento solicitado pela equipe",
  },
  counterPropose: {
    actingAsStaffId,
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
  },
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

  const [accept, reject, cancel, counterPropose] = await Promise.all([
    import(
      "~/server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/collection-requests/[requestId]/accept.post"
    ),
    import(
      "~/server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/collection-requests/[requestId]/reject.post"
    ),
    import(
      "~/server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/collection-requests/[requestId]/cancel.post"
    ),
    import(
      "~/server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/collection-requests/[requestId]/counter-propose.post"
    ),
  ]);

  handlers.accept = accept.default as Handler;
  handlers.reject = reject.default as Handler;
  handlers.cancel = cancel.default as Handler;
  handlers.counterPropose = counterPropose.default as Handler;
});

beforeEach(() => {
  mocks.assertSecretAuth.mockReset();
  mocks.acceptCollectionRequest.mockReset();
  mocks.rejectCollectionRequest.mockReset();
  mocks.cancelCollectionRequest.mockReset();
  mocks.counterPropose.mockReset();

  mocks.assertSecretAuth.mockImplementation((event: FakeEvent) => {
    if (event.headers.get("x-secret") !== "valid-secret") {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    }
  });
  mocks.acceptCollectionRequest.mockResolvedValue({ id: requestId });
  mocks.rejectCollectionRequest.mockResolvedValue({ id: requestId });
  mocks.cancelCollectionRequest.mockResolvedValue({ id: requestId });
  mocks.counterPropose.mockResolvedValue({ id: requestId });
});

describe("ações de collection request no backoffice", () => {
  it("aceita via secret e passa actingAsStaffId ao service", async () => {
    const response = await handlers.accept(makeEvent(validBodies.accept));

    expect(response).toEqual({
      success: true,
      data: { id: requestId },
      message: "Collection request accepted successfully",
    });
    expect(mocks.acceptCollectionRequest).toHaveBeenCalledWith(
      requestId,
      "available-date-a",
      "slot-a",
      actingAsStaffId,
      bloodBanksLocationId,
      false
    );
  });

  it("rejeita via secret e passa actingAsStaffId ao service", async () => {
    const response = await handlers.reject(makeEvent(validBodies.reject));

    expect(response).toEqual({
      success: true,
      data: { id: requestId },
      message: "Collection request rejected successfully",
    });
    expect(mocks.rejectCollectionRequest).toHaveBeenCalledWith(
      requestId,
      "Data indisponível",
      actingAsStaffId,
      bloodBanksLocationId
    );
  });

  it("cancela via secret e passa actingAsStaffId ao service", async () => {
    const response = await handlers.cancel(makeEvent(validBodies.cancel));

    expect(response).toEqual({
      success: true,
      data: { id: requestId },
      message: "Collection request cancelled successfully",
    });
    expect(mocks.cancelCollectionRequest).toHaveBeenCalledWith(
      requestId,
      "Cancelamento solicitado pela equipe",
      actingAsStaffId,
      bloodBanksLocationId
    );
  });

  it("faz contraproposta via secret e passa actingAsStaffId como proposedBy", async () => {
    const response = await handlers.counterPropose(
      makeEvent(validBodies.counterPropose)
    );

    expect(response).toEqual({
      success: true,
      data: { id: requestId },
      message: "Counter proposal created successfully",
    });
    expect(mocks.counterPropose).toHaveBeenCalledWith(requestId, {
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
      proposedBy: actingAsStaffId,
    });
  });

  it.each(Object.keys(validBodies) as Action[])(
    "retorna 400 quando %s não recebe actingAsStaffId",
    async (action) => {
      const body = { ...validBodies[action] };
      delete body.actingAsStaffId;

      await expect(handlers[action](makeEvent(body))).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(mocks[serviceMockFor(action)]).not.toHaveBeenCalled();
    }
  );

  it.each(Object.keys(validBodies) as Action[])(
    "preserva 401 quando o secret está ausente ou inválido em %s",
    async (action) => {
      await expect(handlers[action](makeEvent({}, {}))).rejects.toMatchObject({
        statusCode: 401,
      });
    }
  );

  it.each(Object.keys(validBodies) as Action[])(
    "preserva 403 devolvido pelo guard de secret em %s",
    async (action) => {
      mocks.assertSecretAuth.mockImplementation(() => {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      });

      await expect(
        handlers[action](makeEvent(validBodies[action]))
      ).rejects.toMatchObject({ statusCode: 403 });
    }
  );
});

function serviceMockFor(action: Action) {
  return {
    accept: "acceptCollectionRequest",
    reject: "rejectCollectionRequest",
    cancel: "cancelCollectionRequest",
    counterPropose: "counterPropose",
  }[action] as keyof typeof mocks;
}

afterAll(() => {
  vi.unstubAllGlobals();
});
