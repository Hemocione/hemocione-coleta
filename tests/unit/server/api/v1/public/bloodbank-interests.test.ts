import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBloodBankByBloodBanksLocationId: vi.fn(),
  getOndeDoarBloodBankByLocationId: vi.fn(),
  createBloodBankInterest: vi.fn(),
  useHemocioneUserAuth: vi.fn(),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getBloodBankByBloodBanksLocationId: (...args: unknown[]) =>
    mocks.getBloodBankByBloodBanksLocationId(...args),
}));

vi.mock("~/server/services/bloodBankInterest", () => ({
  createBloodBankInterest: (...args: unknown[]) =>
    mocks.createBloodBankInterest(...args),
}));

vi.mock("~/server/services/ondeDoar", () => ({
  getOndeDoarBloodBankByLocationId: (...args: unknown[]) =>
    mocks.getOndeDoarBloodBankByLocationId(...args),
}));

vi.mock("~/server/services/auth", () => ({
  useHemocioneUserAuth: (...args: unknown[]) => mocks.useHemocioneUserAuth(...args),
}));

interface FakeEvent {
  body: unknown;
  headers: { get: (name: string) => string | null };
}

const locationId = "123e4567-e89b-12d3-a456-426614174000";

let handler: (event: FakeEvent) => Promise<unknown>;

function makeEvent(body: unknown, authorization?: string): FakeEvent {
  return {
    body,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? authorization ?? null : null,
    },
  };
}

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal("readBody", (event: FakeEvent) => event.body);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );

  const mod = await import("~/server/api/v1/public/bloodbank-interests/index.post");
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.getBloodBankByBloodBanksLocationId.mockReset().mockResolvedValue(null);
  mocks.getOndeDoarBloodBankByLocationId.mockReset().mockResolvedValue({
    bloodBanksLocationId: locationId,
    name: "Banco canônico do OndeDoar",
    origin: "ondedoar",
  });
  mocks.createBloodBankInterest.mockReset().mockResolvedValue({
    id: "interest-a",
    created: true,
    deliveryStatus: "disabled",
  });
  mocks.useHemocioneUserAuth.mockReset();
});

describe("POST /api/v1/public/bloodbank-interests", () => {
  it("aceita anônimo e usa nome e telefone do corpo", async () => {
    const response = await handler(
      makeEvent({
        bloodBanksLocationId: locationId,
        bankName: "Banco A",
        name: "Pessoa Anônima",
        phone: "(11) 99999-9999",
        origin: "ondedoar",
      }),
    );

    expect(response).toEqual({
      success: true,
      data: { id: "interest-a", created: true, deliveryStatus: "disabled" },
    });
    expect(mocks.createBloodBankInterest).toHaveBeenCalledWith({
      bloodBanksLocationId: locationId,
      bankName: "Banco canônico do OndeDoar",
      name: "Pessoa Anônima",
      phone: "(11) 99999-9999",
      phoneNormalized: "11999999999",
      userId: undefined,
      origin: "ondedoar",
      dedupeKey: `${locationId}:11999999999`,
    });
  });

  it("usa os dados da sessão e ignora valores falsos do cliente", async () => {
    mocks.useHemocioneUserAuth.mockReturnValue({
      id: "user-a",
      givenName: "Nome",
      surName: "Da Sessão",
      phone: "+55 (11) 98888-7777",
    });

    await handler(
      makeEvent(
        {
          bloodBanksLocationId: locationId,
          bankName: "Banco A",
          name: "Nome falso",
          phone: "11911111111",
          origin: "ondedoar",
        },
        "Bearer valid-token",
      ),
    );

    expect(mocks.useHemocioneUserAuth).toHaveBeenCalled();
    expect(mocks.createBloodBankInterest).toHaveBeenCalledWith(
        expect.objectContaining({
        name: "Nome Da Sessão",
        phone: "+55 (11) 98888-7777",
        userId: "user-a",
        phoneNormalized: "5511988887777",
        bankName: "Banco canônico do OndeDoar",
      }),
    );
  });

  it("não usa telefone do cliente quando a sessão autenticada não tem telefone", async () => {
    mocks.useHemocioneUserAuth.mockReturnValue({
      id: "user-a",
      givenName: "Nome",
      surName: "Da Sessão",
      phone: "",
    });

    await expect(
      handler(
        makeEvent(
          {
            bloodBanksLocationId: locationId,
            name: "Nome falso",
            phone: "11911111111",
            origin: "ondedoar",
          },
          "Bearer valid-token",
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.createBloodBankInterest).not.toHaveBeenCalled();
  });

  it("valida o nome derivado da sessão antes de persistir", async () => {
    mocks.useHemocioneUserAuth.mockReturnValue({
      id: "user-a",
      givenName: "a".repeat(201),
      surName: "",
      phone: "11999999999",
    });

    await expect(
      handler(
        makeEvent(
          {
            bloodBanksLocationId: locationId,
            name: "Nome falso",
            phone: "11911111111",
            origin: "ondedoar",
          },
          "Bearer valid-token",
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.createBloodBankInterest).not.toHaveBeenCalled();
  });

  it("rejeita identificador que não existe no catálogo do OndeDoar", async () => {
    mocks.getOndeDoarBloodBankByLocationId.mockResolvedValue(null);

    await expect(
      handler(
        makeEvent({
          bloodBanksLocationId: locationId,
          bankName: "Banco forjado",
          name: "Pessoa",
          phone: "11999999999",
          origin: "ondedoar",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.getBloodBankByBloodBanksLocationId).not.toHaveBeenCalled();
    expect(mocks.createBloodBankInterest).not.toHaveBeenCalled();
  });

  it("rejeita dados anônimos sem nome ou com telefone inválido", async () => {
    await expect(
      handler(
        makeEvent({
          bloodBanksLocationId: locationId,
          bankName: "Banco A",
          name: " ",
          phone: "telefone inválido",
          origin: "ondedoar",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.createBloodBankInterest).not.toHaveBeenCalled();
  });

  it("rejeita token inválido antes de persistir", async () => {
    mocks.useHemocioneUserAuth.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    await expect(
      handler(
        makeEvent(
          {
            bloodBanksLocationId: locationId,
            bankName: "Banco A",
            name: "Nome falso",
            phone: "11911111111",
            origin: "ondedoar",
          },
          "Bearer invalid-token",
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.getOndeDoarBloodBankByLocationId).not.toHaveBeenCalled();
    expect(mocks.createBloodBankInterest).not.toHaveBeenCalled();
  });

  it("rejeita interesse para banco ativo no Coleta", async () => {
    mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
      name: "Banco ativo",
      active: true,
    });

    await expect(
      handler(
        makeEvent({
          bloodBanksLocationId: locationId,
          bankName: "Banco A",
          name: "Pessoa",
          phone: "11999999999",
          origin: "ondedoar",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.createBloodBankInterest).not.toHaveBeenCalled();
  });

  it("não reintroduz banco hidden pelo catálogo externo", async () => {
    mocks.getBloodBankByBloodBanksLocationId.mockResolvedValue({
      name: "Banco oculto",
      active: true,
      hidden: true,
    });

    await expect(
      handler(
        makeEvent({
          bloodBanksLocationId: locationId,
          bankName: "Banco A",
          name: "Pessoa",
          phone: "11999999999",
          origin: "ondedoar",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.createBloodBankInterest).not.toHaveBeenCalled();
  });

  it("retorna erro de delivery sem esconder a persistência", async () => {
    mocks.createBloodBankInterest.mockRejectedValue(
      Object.assign(new Error("Interest saved but Discord delivery failed"), {
        statusCode: 502,
      }),
    );

    await expect(
      handler(
        makeEvent({
          bloodBanksLocationId: locationId,
          bankName: "Banco A",
          name: "Pessoa",
          phone: "11999999999",
          origin: "ondedoar",
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
