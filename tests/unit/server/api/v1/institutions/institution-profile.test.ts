import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInstitutionProfile: vi.fn(),
  updateInstitutionProfile: vi.fn(),
}));

vi.mock("~/server/services/hemocioneId", () => ({
  getInstitutionProfile: (...args: unknown[]) => mocks.getInstitutionProfile(...args),
  updateInstitutionProfile: (...args: unknown[]) =>
    mocks.updateInstitutionProfile(...args),
}));

interface FakeEvent {
  context: {
    params: Record<string, string>;
    auth?: { token?: string };
  };
  body?: unknown;
}

type Handler = (event: FakeEvent) => Promise<unknown>;

const institutionId = "11111111-1111-4111-8111-111111111111";
const token = "jwt-token";
let getHandler: Handler;
let patchHandler: Handler;

function makeEvent(body?: unknown, authenticated = true): FakeEvent {
  return {
    context: {
      params: { institutionId },
      auth: authenticated ? { token } : undefined,
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

  const [getModule, patchModule] = await Promise.all([
    import("~/server/api/v1/institutions/[institutionId]/index.get"),
    import("~/server/api/v1/institutions/[institutionId]/index.patch"),
  ]);
  getHandler = getModule.default as Handler;
  patchHandler = patchModule.default as Handler;
});

beforeEach(() => {
  mocks.getInstitutionProfile.mockReset();
  mocks.updateInstitutionProfile.mockReset();
  mocks.getInstitutionProfile.mockResolvedValue({ id: institutionId, name: "Instituição A" });
  mocks.updateInstitutionProfile.mockResolvedValue({ id: institutionId, name: "Instituição Atualizada" });
});

describe("institution profile adapter", () => {
  it("forwards the authenticated token on GET", async () => {
    await expect(getHandler(makeEvent())).resolves.toEqual({
      institution: { id: institutionId, name: "Instituição A" },
    });
    expect(mocks.getInstitutionProfile).toHaveBeenCalledWith(token, institutionId);
  });

  it("rejects an invalid institution id before the upstream call", async () => {
    await expect(
      getHandler({
        context: { params: { institutionId: "not-an-id" }, auth: { token } },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.getInstitutionProfile).not.toHaveBeenCalled();
  });

  it("accepts only editable profile fields on PATCH", async () => {
    const body = {
      name: "Instituição Atualizada",
      address: "Rua Nova, 10",
      city: "São Paulo",
      state: "SP",
      phone: "+5511999999999",
    };
    await patchHandler(makeEvent(body));

    expect(mocks.updateInstitutionProfile).toHaveBeenCalledWith(
      token,
      institutionId,
      body
    );
  });

  it("rejects protected fields before the upstream call", async () => {
    await expect(patchHandler(makeEvent({ document: "11222333000181" }))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.updateInstitutionProfile).not.toHaveBeenCalled();
  });

  it("preserves an upstream authorization status", async () => {
    mocks.updateInstitutionProfile.mockRejectedValue({
      statusCode: 403,
      message: "Forbidden",
    });

    await expect(patchHandler(makeEvent({ name: "Sem acesso" }))).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
