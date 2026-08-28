import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserInstitutions: vi.fn(),
  collectionRequestFindOne: vi.fn(),
  withdrawCollectionRequest: vi.fn(),
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getUserInstitutions: (...args: unknown[]) => mocks.getUserInstitutions(...args),
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
    },
  },
}));

vi.mock("~/server/services/collectionRequest", () => ({
  withdrawCollectionRequest: (...args: unknown[]) =>
    mocks.withdrawCollectionRequest(...args),
}));

interface FakeEvent {
  context: {
    params: Record<string, string>;
    auth?: {
      token: string;
      user: { id: string };
    };
  };
  body: unknown;
  headers: {
    get: (name: string) => string | null;
  };
}

const institutionId = "institution-a";
const requestId = "request-a";
const userId = "user-a";

function makeEvent(body: unknown = {}): FakeEvent {
  return {
    context: {
      params: { institutionId, requestId },
      auth: {
        token: "token-de-teste",
        user: { id: userId },
      },
    },
    body,
    headers: {
      get: () => "Bearer token-de-teste",
    },
  };
}

function mockRequest(request: Record<string, unknown> | null) {
  const lean = vi.fn().mockResolvedValue(request);
  mocks.collectionRequestFindOne.mockReturnValue({ lean });
  return lean;
}

let handler: (event: FakeEvent) => Promise<unknown>;

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
    "~/server/api/v1/institutions/[institutionId]/collection-requests/[requestId]/withdraw.post"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.getUserInstitutions.mockReset();
  mocks.collectionRequestFindOne.mockReset();
  mocks.withdrawCollectionRequest.mockReset();

  mocks.getUserInstitutions.mockResolvedValue([{ id: institutionId }]);
  mockRequest({ _id: requestId, institutionId, status: "pending" });
  mocks.withdrawCollectionRequest.mockResolvedValue({ _id: requestId });
});

describe(
  "POST /api/v1/institutions/:institutionId/collection-requests/:requestId/withdraw",
  () => {
    it("retorna 401 sem contexto de autenticação e não consulta instituições", async () => {
      const event = makeEvent();
      event.context.auth = undefined;

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 401,
      });
      expect(mocks.getUserInstitutions).not.toHaveBeenCalled();
      expect(mocks.collectionRequestFindOne).not.toHaveBeenCalled();
    });

    it("retorna 403 e não acessa a solicitação sem acesso à instituição", async () => {
      mocks.getUserInstitutions.mockResolvedValue([
        { id: "institution-b" },
      ]);

      await expect(handler(makeEvent())).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(mocks.getUserInstitutions).toHaveBeenCalledWith("token-de-teste");
      expect(mocks.collectionRequestFindOne).not.toHaveBeenCalled();
      expect(mocks.withdrawCollectionRequest).not.toHaveBeenCalled();
    });

    it("retira a solicitação autorizada usando o ID do usuário autenticado", async () => {
      const updatedRequest = { _id: requestId, status: "withdrawn" };
      mocks.withdrawCollectionRequest.mockResolvedValue(updatedRequest);

      await expect(handler(makeEvent({ reason: "Motivo do teste" }))).resolves.toEqual({
        success: true,
        data: updatedRequest,
        message: "Solicitação retirada com sucesso",
      });
      expect(mocks.getUserInstitutions).toHaveBeenCalledWith("token-de-teste");
      expect(mocks.collectionRequestFindOne).toHaveBeenCalledWith({
        _id: requestId,
        institutionId,
        deletedAt: null,
      });
      expect(mocks.withdrawCollectionRequest).toHaveBeenCalledWith(
        requestId,
        userId,
        "Motivo do teste"
      );
    });

    it("retorna 404 quando a solicitação não existe para o usuário autorizado", async () => {
      mockRequest(null);

      await expect(handler(makeEvent())).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(mocks.getUserInstitutions).toHaveBeenCalledWith("token-de-teste");
      expect(mocks.withdrawCollectionRequest).not.toHaveBeenCalled();
    });
  }
);

afterAll(() => {
  vi.unstubAllGlobals();
});
