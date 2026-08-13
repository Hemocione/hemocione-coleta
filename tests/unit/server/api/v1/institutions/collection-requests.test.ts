import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useHemocioneUserAuth: vi.fn(),
  assertUserAccessToInstitutionId: vi.fn(),
  getCollectionRequestsByInstitution: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  useHemocioneUserAuth: (...args: unknown[]) =>
    mocks.useHemocioneUserAuth(...args),
  assertUserAccessToInstitutionId: (...args: unknown[]) =>
    mocks.assertUserAccessToInstitutionId(...args),
}));

vi.mock("~/server/services/collectionRequest", () => ({
  getCollectionRequestsByInstitution: (...args: unknown[]) =>
    mocks.getCollectionRequestsByInstitution(...args),
}));

interface FakeEvent {
  context: {
    params: Record<string, string>;
  };
  headers: {
    get: (name: string) => string | null;
  };
  query: Record<string, string>;
}

interface TestUser {
  institutionRoles: Array<{
    institutionId: string;
    role: "admin" | "staff";
  }>;
}

const institutionId = "institution-a";

function makeEvent(
  query: Record<string, string> = {},
  requestedInstitutionId = institutionId
): FakeEvent {
  return {
    context: {
      params: { institutionId: requestedInstitutionId },
    },
    headers: {
      get: () => "Bearer token-de-teste",
    },
    query,
  };
}

function makeUser(
  institutionIds: string[] = [institutionId]
): TestUser {
  return {
    institutionRoles: institutionIds.map((id) => ({
      institutionId: id,
      role: "staff" as const,
    })),
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
  mocks.useHemocioneUserAuth.mockReset();
  mocks.assertUserAccessToInstitutionId.mockReset();
  mocks.getCollectionRequestsByInstitution.mockReset();

  mocks.useHemocioneUserAuth.mockReturnValue(makeUser());
  mocks.assertUserAccessToInstitutionId.mockImplementation(
    (user: TestUser, requestedInstitutionId: string) => {
      if (
        !user.institutionRoles.some(
          (role) => role.institutionId === requestedInstitutionId
        )
      ) {
        throw Object.assign(
          new Error("User does not have access to this institution"),
          { statusCode: 403 }
        );
      }
    }
  );
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
    mocks.useHemocioneUserAuth.mockReturnValue(makeUser(["institution-b"]));

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
