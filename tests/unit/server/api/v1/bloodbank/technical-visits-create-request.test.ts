import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertUserAccessToBloodBanksLocationId: vi.fn(),
  getCollectionRequestById: vi.fn(),
  getCollectionRequestsByBloodBank: vi.fn(),
  createTechnicalVisit: vi.fn(),
  linkTechnicalVisitToCollectionRequest: vi.fn(),
  updateTechnicalVisit: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertUserAccessToBloodBanksLocationId: (...args: unknown[]) =>
    mocks.assertUserAccessToBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  getCollectionRequestById: (...args: unknown[]) =>
    mocks.getCollectionRequestById(...args),
  getCollectionRequestsByBloodBank: (...args: unknown[]) =>
    mocks.getCollectionRequestsByBloodBank(...args),
}));

vi.mock("~/server/services/technicalVisit", () => ({
  createTechnicalVisit: (...args: unknown[]) =>
    mocks.createTechnicalVisit(...args),
  linkTechnicalVisitToCollectionRequest: (...args: unknown[]) =>
    mocks.linkTechnicalVisitToCollectionRequest(...args),
  updateTechnicalVisit: (...args: unknown[]) => mocks.updateTechnicalVisit(...args),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: vi.fn(),
}));
vi.mock("~/server/services/commitmentTerm", () => ({
  createCommitmentTerm: vi.fn(),
  getTemplateForBloodBank: vi.fn(),
  renderTemplate: vi.fn(),
}));
vi.mock("~/server/services/notification", () => ({
  sendWhatsAppNotificationToPhone: vi.fn(),
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
let handler: Handler;

function makeEvent(body: unknown): FakeEvent {
  return {
    context: {
      auth: { user: { id: "blood-bank-user" } },
      params: { bloodbanksLocationId: bloodBanksLocationId },
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
    "~/server/api/v1/bloodbank/[bloodbanksLocationId]/technical-visits/index.post"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getCollectionRequestById.mockResolvedValue({
    _id: requestId,
    institutionId: "institution-from-request",
    status: "awaiting_technical_visit",
  });
  mocks.getCollectionRequestsByBloodBank.mockResolvedValue({
    data: [{ institutionId: "550e8400-e29b-41d4-a716-446655440000" }],
    pagination: { total: 1, page: 1, limit: 1, pages: 1 },
  });
  mocks.createTechnicalVisit.mockResolvedValue({
    _id: "visit-a",
    institutionId: "institution-from-request",
  });
  mocks.linkTechnicalVisitToCollectionRequest.mockResolvedValue({
    _id: requestId,
    technicalVisitId: "visit-a",
  });
});

describe("POST technical-visits", () => {
  it("carrega institutionId da solicitação escolhida e cria o vínculo existente", async () => {
    const response = await handler(
      makeEvent({
        requestId,
        address: "Rua informada na visita, 10",
        visitDate: "2999-01-15",
        outcome: "pending",
        notes: null,
      })
    );

    expect(response).toMatchObject({ success: true, data: { _id: "visit-a" } });
    expect(mocks.getCollectionRequestById).toHaveBeenCalledWith(
      requestId,
      bloodBanksLocationId
    );
    expect(mocks.createTechnicalVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        bloodBanksLocationId,
        institutionId: "institution-from-request",
        address: "Rua informada na visita, 10",
      })
    );
    expect(mocks.linkTechnicalVisitToCollectionRequest).toHaveBeenCalledWith(
      requestId,
      bloodBanksLocationId,
      "visit-a"
    );
  });

  it("rejeita solicitação ausente ou já resolvida antes de criar a visita", async () => {
    mocks.getCollectionRequestById.mockResolvedValue({
      _id: requestId,
      institutionId: "institution-a",
      status: "scheduled",
    });

    await expect(
      handler(
        makeEvent({
          requestId,
          address: "Rua A, 1",
          visitDate: "2999-01-15",
          outcome: "pending",
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.createTechnicalVisit).not.toHaveBeenCalled();
  });

  it("permite visita manual somente para instituição associada ao banco", async () => {
    const institutionId = "550e8400-e29b-41d4-a716-446655440000";

    await handler(
      makeEvent({
        institutionId,
        address: "Rua A, 1",
        visitDate: "2999-01-15",
        outcome: "pending",
      })
    );

    expect(mocks.getCollectionRequestsByBloodBank).toHaveBeenCalledWith(
      bloodBanksLocationId,
      { institutionId },
      { page: 1, limit: 1 }
    );
    expect(mocks.createTechnicalVisit).toHaveBeenCalledWith(
      expect.objectContaining({ institutionId })
    );
  });

  it("rejeita visita manual para instituição não associada ao banco", async () => {
    mocks.getCollectionRequestsByBloodBank.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 1, pages: 0 },
    });

    await expect(
      handler(
        makeEvent({
          institutionId: "550e8400-e29b-41d4-a716-446655440001",
          address: "Rua externa, 1",
          visitDate: "2999-01-15",
          outcome: "pending",
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.createTechnicalVisit).not.toHaveBeenCalled();
  });
});
