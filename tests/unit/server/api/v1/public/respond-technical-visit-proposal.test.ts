import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useHemocioneUserAuth: vi.fn(),
  getCollectionRequestIdByToken: vi.fn(),
  respondToTechnicalVisitProposal: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  useHemocioneUserAuth: (...args: unknown[]) => mocks.useHemocioneUserAuth(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  getCollectionRequestIdByToken: (...args: unknown[]) =>
    mocks.getCollectionRequestIdByToken(...args),
  respondToTechnicalVisitProposal: (...args: unknown[]) =>
    mocks.respondToTechnicalVisitProposal(...args),
}));

interface FakeEvent {
  context: { params: Record<string, string> };
  headers: { get: (name: string) => string | null };
  body: unknown;
}

type Handler = (event: FakeEvent) => Promise<unknown>;

const token = "access-token-a";
const requestId = "request-a";
const userId = "institution-user-a";

let handler: Handler;

function makeEvent(body: unknown, hasAuthHeader = true): FakeEvent {
  return {
    context: { params: { token } },
    headers: { get: () => (hasAuthHeader ? "Bearer jwt-valido" : null) },
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
    "~/server/api/v1/public/collection-requests/track/[token]/respond-technical-visit-proposal.post"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  mocks.useHemocioneUserAuth.mockReset();
  mocks.getCollectionRequestIdByToken.mockReset();
  mocks.respondToTechnicalVisitProposal.mockReset();

  mocks.useHemocioneUserAuth.mockReturnValue({ id: userId });
  mocks.getCollectionRequestIdByToken.mockResolvedValue({
    requestId,
    requestedByUserId: userId,
  });
  mocks.respondToTechnicalVisitProposal.mockResolvedValue({
    _id: requestId,
    status: "awaiting_technical_visit",
  });
});

describe("POST respond-technical-visit-proposal", () => {
  it("aceita uma opção e repassa a identidade da instituição", async () => {
    const response = await handler(
      makeEvent({ decision: "accepted", selectedDateId: "0" })
    );

    expect(response).toEqual({
      success: true,
      data: { _id: requestId, status: "awaiting_technical_visit" },
      message: "Proposta de visita técnica respondida com sucesso",
    });
    expect(mocks.respondToTechnicalVisitProposal).toHaveBeenCalledWith(
      requestId,
      {
        decision: "accepted",
        selectedDateId: "0",
        respondedBy: userId,
      }
    );
  });

  it("recusa a proposta", async () => {
    await handler(makeEvent({ decision: "declined", selectedDateId: "" }));

    expect(mocks.respondToTechnicalVisitProposal).toHaveBeenCalledWith(
      requestId,
      {
        decision: "declined",
        selectedDateId: "",
        respondedBy: userId,
      }
    );
  });

  it("retorna 401 sem header Authorization", async () => {
    await expect(
      handler(makeEvent({ decision: "accepted", selectedDateId: "0" }, false))
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.respondToTechnicalVisitProposal).not.toHaveBeenCalled();
  });

  it("retorna 403 quando o usuário não é dono da solicitação", async () => {
    mocks.getCollectionRequestIdByToken.mockResolvedValue({
      requestId,
      requestedByUserId: "outro-usuario",
    });

    await expect(
      handler(makeEvent({ decision: "accepted", selectedDateId: "0" }))
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.respondToTechnicalVisitProposal).not.toHaveBeenCalled();
  });

  it("retorna 404 quando o token não resolve nenhuma solicitação", async () => {
    mocks.getCollectionRequestIdByToken.mockResolvedValue(null);

    await expect(
      handler(makeEvent({ decision: "accepted", selectedDateId: "0" }))
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("retorna 400 para body inválido", async () => {
    await expect(
      handler(makeEvent({ decision: "maybe", selectedDateId: "0" }))
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.respondToTechnicalVisitProposal).not.toHaveBeenCalled();
  });
});
