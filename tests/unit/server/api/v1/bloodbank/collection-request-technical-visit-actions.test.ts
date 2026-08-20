import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  acceptCollectionRequest: vi.fn(),
  reuseTechnicalVisit: vi.fn(),
  registerRetroactiveVisit: vi.fn(),
  scheduleNewTechnicalVisit: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  acceptCollectionRequest: (...args: unknown[]) =>
    mocks.acceptCollectionRequest(...args),
  reuseTechnicalVisit: (...args: unknown[]) =>
    mocks.reuseTechnicalVisit(...args),
  registerRetroactiveVisit: (...args: unknown[]) =>
    mocks.registerRetroactiveVisit(...args),
  scheduleNewTechnicalVisit: (...args: unknown[]) =>
    mocks.scheduleNewTechnicalVisit(...args),
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
const handlers = {} as {
  accept: Handler;
  reuse: Handler;
  retroactive: Handler;
  schedule: Handler;
};

function makeEvent(body: unknown): FakeEvent {
  return {
    context: {
      auth: { user: { id: userId } },
      params: { bloodbanksLocationId: bloodBanksLocationId, requestId },
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

  const [accept, reuse, retroactive, schedule] = await Promise.all([
    import(
      "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/accept.post"
    ),
    import(
      "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/reuse-technical-visit.post"
    ),
    import(
      "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/register-retroactive-visit.post"
    ),
    import(
      "~/server/api/v1/bloodbank/[bloodbanksLocationId]/collection-requests/[requestId]/schedule-new-visit.post"
    ),
  ]);

  handlers.accept = accept.default as Handler;
  handlers.reuse = reuse.default as Handler;
  handlers.retroactive = retroactive.default as Handler;
  handlers.schedule = schedule.default as Handler;
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.acceptCollectionRequest.mockResolvedValue({ status: "awaiting_technical_visit" });
  mocks.reuseTechnicalVisit.mockResolvedValue({ status: "technical_visit_confirmed" });
  mocks.registerRetroactiveVisit.mockResolvedValue({ status: "technical_visit_confirmed" });
  mocks.scheduleNewTechnicalVisit.mockResolvedValue({ status: "awaiting_technical_visit" });
});

describe("rotas de resolução de visita técnica", () => {
  it("aceita uma solicitação com necessidade de visita", async () => {
    await handlers.accept(
      makeEvent({
        selectedAvailableDateId: "available-date-a",
        selectedSlotId: "slot-a",
        needsTechnicalVisit: true,
      })
    );

    expect(mocks.acceptCollectionRequest).toHaveBeenCalledWith(
      requestId,
      "available-date-a",
      "slot-a",
      userId,
      bloodBanksLocationId,
      true
    );
  });

  it("reutiliza visita aprovada pela rota JWT", async () => {
    await handlers.reuse(makeEvent({ technicalVisitId: "visit-a" }));

    expect(mocks.reuseTechnicalVisit).toHaveBeenCalledWith(requestId, {
      technicalVisitId: "visit-a",
      bloodBanksLocationId,
      changedByUserId: userId,
    });
  });

  it("registra visita retroativa pela rota JWT", async () => {
    await handlers.retroactive(
      makeEvent({
        visitDate: "2026-09-10T10:00:00.000Z",
        note: "Visita realizada antes do registro",
      })
    );

    expect(mocks.registerRetroactiveVisit).toHaveBeenCalledWith(requestId, {
      visitDate: new Date("2026-09-10T10:00:00.000Z"),
      note: "Visita realizada antes do registro",
      bloodBanksLocationId,
      changedByUserId: userId,
    });
  });

  it("agenda nova visita pela rota JWT", async () => {
    await handlers.schedule(
      makeEvent({ visitDate: "2026-09-12T10:00:00.000Z" })
    );

    expect(mocks.scheduleNewTechnicalVisit).toHaveBeenCalledWith(requestId, {
      visitDate: new Date("2026-09-12T10:00:00.000Z"),
      bloodBanksLocationId,
      changedByUserId: userId,
    });
  });

  it("mapeia visita não aprovada para 400", async () => {
    mocks.reuseTechnicalVisit.mockRejectedValue(
      new Error("Technical visit must be approved")
    );

    await expect(
      handlers.reuse(makeEvent({ technicalVisitId: "visit-pending" }))
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("mapeia visita de outro banco para 404", async () => {
    mocks.reuseTechnicalVisit.mockRejectedValue(
      new Error("Technical visit not found for this blood bank")
    );

    await expect(
      handlers.reuse(makeEvent({ technicalVisitId: "visit-other-bank" }))
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
