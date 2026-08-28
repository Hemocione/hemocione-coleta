import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSecretAuth: vi.fn(),
  updateBloodBankSettings: vi.fn(),
}));

vi.mock("~/server/services/auth", () => ({
  assertSecretAuth: (...args: unknown[]) => mocks.assertSecretAuth(...args),
}));

vi.mock("~/server/services/bloodBank", () => ({
  updateBloodBankSettings: (...args: unknown[]) =>
    mocks.updateBloodBankSettings(...args),
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

const bloodBanksLocationId = "123e4567-e89b-12d3-a456-426614174000";

function makeEvent(body: unknown): FakeEvent {
  return {
    context: { params: { bloodbanksLocationId: bloodBanksLocationId } },
    body,
    headers: { get: () => "secret-de-teste" },
  };
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name],
  );
  vi.stubGlobal("readBody", (event: FakeEvent) => event.body);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );

  const mod = await import(
    "~/server/api/backoffice/v1/bloodbanks/[bloodbanksLocationId]/settings.put"
  );
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.assertSecretAuth.mockReset();
  mocks.updateBloodBankSettings.mockReset();
  mocks.updateBloodBankSettings.mockResolvedValue({
    bloodBanksLocationId,
    hidden: true,
  });
});

describe("PUT /api/backoffice/v1/bloodbanks/:bloodbanksLocationId/settings", () => {
  it("atualiza hidden usando o secret de backoffice", async () => {
    const event = makeEvent({ hidden: true });

    const response = await handler(event);

    expect(response).toEqual({
      success: true,
      data: { bloodBanksLocationId, hidden: true },
    });
    expect(mocks.assertSecretAuth).toHaveBeenCalledWith(event);
    expect(mocks.updateBloodBankSettings).toHaveBeenCalledWith(
      bloodBanksLocationId,
      { hidden: true },
    );
  });

  it("aceita reexibir o banco com hidden false", async () => {
    mocks.updateBloodBankSettings.mockResolvedValue({
      bloodBanksLocationId,
      hidden: false,
    });

    const response = await handler(makeEvent({ hidden: false }));

    expect(response).toEqual({
      success: true,
      data: { bloodBanksLocationId, hidden: false },
    });
  });

  it("rejeita corpo sem hidden", async () => {
    await expect(handler(makeEvent({}))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.updateBloodBankSettings).not.toHaveBeenCalled();
  });

  it("rejeita campos desconhecidos", async () => {
    await expect(
      handler(makeEvent({ hidden: true, name: "Banco alterado" })),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.updateBloodBankSettings).not.toHaveBeenCalled();
  });

  it("rejeita um identificador de localização inválido", async () => {
    const event = makeEvent({ hidden: true });
    event.context.params.bloodbanksLocationId = "not-a-uuid";

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.updateBloodBankSettings).not.toHaveBeenCalled();
  });

  it("não atualiza sem autenticação de backoffice", async () => {
    mocks.assertSecretAuth.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(handler(makeEvent({ hidden: true }))).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(mocks.updateBloodBankSettings).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
