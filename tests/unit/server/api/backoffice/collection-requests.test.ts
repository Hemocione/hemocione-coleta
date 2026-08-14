import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSecretAuth: vi.fn(),
  getCollectionRequests: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertSecretAuth: (...args: unknown[]) => mocks.assertSecretAuth(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  getCollectionRequests: (...args: unknown[]) =>
    mocks.getCollectionRequests(...args),
}));

interface FakeEvent {
  headers: {
    get: (name: string) => string | null;
  };
  query: Record<string, string>;
}

const emptyResult = {
  data: [],
  pagination: { total: 0, page: 1, limit: 20, pages: 0 },
};

function makeEvent(query: Record<string, string> = {}): FakeEvent {
  return {
    headers: {
      get: () => "secret-de-teste",
    },
    query,
  };
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal("getQuery", (event: FakeEvent) => event.query);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );

  const mod = await import(
    "~/server/api/backoffice/v1/collection-requests/index.get"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.assertSecretAuth.mockReset();
  mocks.getCollectionRequests.mockReset();
  mocks.getCollectionRequests.mockResolvedValue(emptyResult);
});

describe("GET /api/backoffice/v1/collection-requests", () => {
  it("sem filtro retorna tudo usando a paginação padrão", async () => {
    const event = makeEvent();

    const response = await handler(event);

    expect(response).toEqual({
      success: true,
      data: [],
      pagination: emptyResult.pagination,
    });
    expect(mocks.assertSecretAuth).toHaveBeenCalledWith(event);
    expect(mocks.getCollectionRequests).toHaveBeenCalledWith(
      {},
      { page: 1, limit: 20 }
    );
  });

  it("filtra somente por institutionId", async () => {
    await handler(makeEvent({ institutionId: "institution-a" }));

    expect(mocks.getCollectionRequests).toHaveBeenCalledWith(
      { institutionId: "institution-a" },
      { page: 1, limit: 20 }
    );
  });

  it("filtra somente por bloodBanksLocationId", async () => {
    await handler(makeEvent({ bloodBanksLocationId: "blood-bank-a" }));

    expect(mocks.getCollectionRequests).toHaveBeenCalledWith(
      { bloodBanksLocationId: "blood-bank-a" },
      { page: 1, limit: 20 }
    );
  });

  it("combina institutionId e bloodBanksLocationId", async () => {
    await handler(
      makeEvent({
        institutionId: "institution-a",
        bloodBanksLocationId: "blood-bank-a",
      })
    );

    expect(mocks.getCollectionRequests).toHaveBeenCalledWith(
      {
        institutionId: "institution-a",
        bloodBanksLocationId: "blood-bank-a",
      },
      { page: 1, limit: 20 }
    );
  });

  it("filtra por status", async () => {
    await handler(makeEvent({ status: "counter_proposed", page: "2", limit: "5" }));

    expect(mocks.getCollectionRequests).toHaveBeenCalledWith(
      { status: "counter_proposed" },
      { page: 2, limit: 5 }
    );
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
