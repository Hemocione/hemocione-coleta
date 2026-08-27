import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useHemocioneUserAuth: vi.fn(),
  getCollectionRequestIdByToken: vi.fn(),
  cancelCollectionRequestByInstitution: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  useHemocioneUserAuth: (...args: unknown[]) => mocks.useHemocioneUserAuth(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  getCollectionRequestIdByToken: (...args: unknown[]) =>
    mocks.getCollectionRequestIdByToken(...args),
  cancelCollectionRequestByInstitution: (...args: unknown[]) =>
    mocks.cancelCollectionRequestByInstitution(...args),
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
    "~/server/api/v1/public/collection-requests/track/[token]/cancel.post"
  );
  handler = mod.default as Handler;
});

beforeEach(() => {
  mocks.useHemocioneUserAuth.mockReset();
  mocks.getCollectionRequestIdByToken.mockReset();
  mocks.cancelCollectionRequestByInstitution.mockReset();

  mocks.useHemocioneUserAuth.mockReturnValue({ id: userId });
  mocks.getCollectionRequestIdByToken.mockResolvedValue({
    requestId,
    requestedByUserId: userId,
  });
  mocks.cancelCollectionRequestByInstitution.mockResolvedValue({
    _id: requestId,
    status: "cancelled",
  });
});

describe("POST /api/v1/public/collection-requests/track/:token/cancel", () => {
  it("cancela a solicitação do usuário e repassa o motivo", async () => {
    const response = await handler(makeEvent({ reason: "Nova data necessária" }));

    expect(response).toEqual({
      success: true,
      data: { _id: requestId, status: "cancelled" },
      message: "Solicitacao cancelada com sucesso",
    });
    expect(mocks.cancelCollectionRequestByInstitution).toHaveBeenCalledWith(
      requestId,
      userId,
      "Nova data necessária"
    );
  });

  it("retorna 401 sem autenticação", async () => {
    await expect(handler(makeEvent({}, false))).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mocks.getCollectionRequestIdByToken).not.toHaveBeenCalled();
  });

  it("retorna 403 quando o token não pertence ao usuário", async () => {
    mocks.getCollectionRequestIdByToken.mockResolvedValue({
      requestId,
      requestedByUserId: "outro-usuario",
    });

    await expect(handler(makeEvent({}))).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.cancelCollectionRequestByInstitution).not.toHaveBeenCalled();
  });

  it("retorna 400 para um motivo muito longo", async () => {
    await expect(handler(makeEvent({ reason: "a".repeat(1001) }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.cancelCollectionRequestByInstitution).not.toHaveBeenCalled();
  });
});
