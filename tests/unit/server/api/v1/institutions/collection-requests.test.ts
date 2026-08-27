import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserInstitutions: vi.fn(),
  getCollectionRequestsByInstitution: vi.fn(),
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getUserInstitutions: (...args: unknown[]) => mocks.getUserInstitutions(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  getCollectionRequestsByInstitution: (...args: unknown[]) =>
    mocks.getCollectionRequestsByInstitution(...args),
}));

interface FakeEvent {
  context: {
    params: Record<string, string>;
    auth: { token: string };
  };
  headers: {
    get: (name: string) => string | null;
  };
  query: Record<string, string>;
}

const institutionId = "institution-a";

function makeEvent(
  query: Record<string, string> = {},
  requestedInstitutionId = institutionId
): FakeEvent {
  return {
    context: {
      params: { institutionId: requestedInstitutionId },
      auth: { token: "token-de-teste" },
    },
    headers: {
      get: () => "Bearer token-de-teste",
    },
    query,
  };
}

const emptyResult = {
  data: [],
  pagination: { total: 0, page: 1, limit: 20, pages: 0 },
};

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name]
  );
  vi.stubGlobal("getQuery", (event: FakeEvent) => event.query);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );

  const mod = await import(
    "~/server/api/v1/institutions/[institutionId]/collection-requests/index.get"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.getUserInstitutions.mockReset();
  mocks.getCollectionRequestsByInstitution.mockReset();

  mocks.getUserInstitutions.mockResolvedValue([{ id: institutionId }]);
  mocks.getCollectionRequestsByInstitution.mockResolvedValue(emptyResult);
});

describe("GET /api/v1/institutions/:institutionId/collection-requests", () => {
  it("retorna 200 com lista vazia quando não há solicitações", async () => {
    const response = await handler(makeEvent());

    expect(response).toEqual({
      success: true,
      data: [],
      pagination: emptyResult.pagination,
    });
    expect(mocks.getCollectionRequestsByInstitution).toHaveBeenCalledWith(
      institutionId,
      {},
      { page: 1, limit: 20 }
    );
  });

  it("retorna somente as solicitações da instituição informada", async () => {
    const requests = [
      { _id: "request-a", institutionId },
      { _id: "request-b", institutionId: "institution-b" },
    ];
    mocks.getCollectionRequestsByInstitution.mockImplementation(
      async (requestedInstitutionId: string) => {
        const data = requests.filter(
          (request) => request.institutionId === requestedInstitutionId
        );
        return {
          data,
          pagination: { total: data.length, page: 1, limit: 20, pages: 1 },
        };
      }
    );

    const response = (await handler(makeEvent())) as {
      success: boolean;
      data: typeof requests;
    };

    expect(response.success).toBe(true);
    expect(response.data).toEqual([
      { _id: "request-a", institutionId },
    ]);
    expect(response.data).not.toContainEqual({
      _id: "request-b",
      institutionId: "institution-b",
    });
    expect(mocks.getCollectionRequestsByInstitution).toHaveBeenCalledWith(
      institutionId,
      {},
      { page: 1, limit: 20 }
    );
  });

  it("retorna 403 quando o usuário não tem institutionRole", async () => {
    mocks.getUserInstitutions.mockResolvedValue([
      { id: "institution-b" },
    ]);

    await expect(handler(makeEvent())).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(mocks.getCollectionRequestsByInstitution).not.toHaveBeenCalled();
  });

  it("aplica o filtro por status e a paginação", async () => {
    const result = {
      data: [{ _id: "request-a", institutionId, status: "accepted" }],
      pagination: { total: 1, page: 2, limit: 5, pages: 1 },
    };
    mocks.getCollectionRequestsByInstitution.mockResolvedValue(result);

    const response = await handler(
      makeEvent({ status: "accepted", page: "2", limit: "5" })
    );

    expect(response).toEqual({ success: true, ...result });
    expect(mocks.getCollectionRequestsByInstitution).toHaveBeenCalledWith(
      institutionId,
      { status: "accepted" },
      { page: 2, limit: 5 }
    );
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
