import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useHemocioneUserAuth: vi.fn(),
  assertUserAccessToInstitutionId: vi.fn(),
  collectionRequestFindOne: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  useHemocioneUserAuth: (...args: unknown[]) =>
    mocks.useHemocioneUserAuth(...args),
  assertUserAccessToInstitutionId: (...args: unknown[]) =>
    mocks.assertUserAccessToInstitutionId(...args),
}));

vi.mock("~/server/models", () => ({
  collectionRequest: {
    CollectionRequest: {
      findOne: (...args: unknown[]) => mocks.collectionRequestFindOne(...args),
    },
  },
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

const institutionId = "institution-a";
const requestId = "request-a";
const config = {
  hemocioneDigitalEventUrl: "https://events.example.test/",
  coletaIntegrationSecret: "coleta-secret",
};

function makeEvent(body: unknown): FakeEvent {
  return {
    context: {
      params: { institutionId, requestId },
    },
    body,
    headers: {
      get: () => "Bearer token-de-teste",
    },
  };
}

function mockRequest(request: Record<string, unknown>) {
  const lean = vi.fn().mockResolvedValue(request);
  mocks.collectionRequestFindOne.mockReturnValue({ lean });
  return lean;
}

function upstreamResponse(
  body: unknown,
  overrides: Record<string, unknown> = {}
) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue(body),
    ...overrides,
  };
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name]
  );
  vi.stubGlobal("readBody", (event: FakeEvent) => event.body);
  vi.stubGlobal("useRuntimeConfig", () => config);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );
  vi.stubGlobal("fetch", mocks.fetch);

  const mod = await import(
    "~/server/api/v1/institutions/[institutionId]/collection-requests/[requestId]/event-branding.put"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.useHemocioneUserAuth.mockReset();
  mocks.assertUserAccessToInstitutionId.mockReset();
  mocks.collectionRequestFindOne.mockReset();
  mocks.fetch.mockReset();

  mocks.useHemocioneUserAuth.mockReturnValue({
    id: "institution-user",
    institutionRoles: [{ institutionId, role: "staff" }],
  });
  mocks.assertUserAccessToInstitutionId.mockImplementation(() => undefined);
  mockRequest({
    _id: requestId,
    institutionId,
    status: "scheduled",
    eventSlug: "campanha-hemocione",
  });
  mocks.fetch.mockResolvedValue(upstreamResponse({ updated: true }));
});

describe("PUT /api/v1/institutions/:institutionId/collection-requests/:requestId/event-branding", () => {
  it("atualiza o branding do evento com sucesso", async () => {
    const event = makeEvent({
      banner: "https://cdn.example.test/banner.png",
      logo: "https://cdn.example.test/logo.png",
      address: "Rua das Flores, 100",
    });

    const response = await handler(event);

    expect(response).toEqual({ success: true, data: { updated: true } });
    expect(mocks.useHemocioneUserAuth).toHaveBeenCalledWith(event);
    expect(mocks.assertUserAccessToInstitutionId).toHaveBeenCalledWith(
      expect.anything(),
      institutionId
    );
    expect(mocks.collectionRequestFindOne).toHaveBeenCalledWith({
      _id: requestId,
      deletedAt: null,
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://events.example.test/api/v1/event/campanha-hemocione",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-coleta-integration-secret": "coleta-secret",
        },
        body: JSON.stringify({
          banner: "https://cdn.example.test/banner.png",
          logo: "https://cdn.example.test/logo.png",
          location: { address: "Rua das Flores, 100" },
        }),
      }
    );
  });

  it("rejeita campos não permitidos no body", async () => {
    await expect(
      handler(
        makeEvent({
          banner: "https://cdn.example.test/banner.png",
          color: "#ffffff",
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("retorna 404 quando a solicitação pertence a outra instituição", async () => {
    mockRequest({
      _id: requestId,
      institutionId: "institution-b",
      status: "scheduled",
      eventSlug: "campanha-hemocione",
    });

    await expect(handler(makeEvent({ address: "Rua das Flores, 100" }))).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o evento ainda não foi gerado", async () => {
    mockRequest({
      _id: requestId,
      institutionId,
      status: "accepted",
      eventSlug: undefined,
    });

    await expect(handler(makeEvent({ address: "Rua das Flores, 100" }))).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: "evento ainda não foi gerado",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("repassa o status quando o serviço de eventos falha", async () => {
    mocks.fetch.mockResolvedValue(
      upstreamResponse(
        { message: "Event not found" },
        { ok: false, status: 404, statusText: "Not Found" }
      )
    );

    await expect(
      handler(makeEvent({ logo: "https://cdn.example.test/logo.png" }))
    ).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: "Event not found",
    });
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
