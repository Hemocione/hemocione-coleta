import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  config: { ondedoarApiUrl: "https://ondedoar.example" },
}));

vi.stubGlobal("$fetch", mocks.fetch);
vi.stubGlobal("useRuntimeConfig", () => mocks.config);

let getNearbyOndeDoarBloodBanks: typeof import("~/server/services/ondeDoar")["getNearbyOndeDoarBloodBanks"];
let getOndeDoarBloodBankByLocationId: typeof import("~/server/services/ondeDoar")["getOndeDoarBloodBankByLocationId"];

const locationA = "123e4567-e89b-12d3-a456-426614174000";
const locationB = "123e4567-e89b-12d3-a456-426614174001";

beforeAll(async () => {
  ({
    getNearbyOndeDoarBloodBanks,
    getOndeDoarBloodBankByLocationId,
  } = await import("~/server/services/ondeDoar"));
});

beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.config.ondedoarApiUrl = "https://ondedoar.example";
});

describe("fonte OndeDoar", () => {
  it("ignora pontos inválidos e nomes acima do limite", async () => {
    mocks.fetch.mockResolvedValue([
      null,
      {
        id: locationA,
        name: "a".repeat(201),
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
    ]);

    await expect(getOndeDoarBloodBankByLocationId(locationA)).resolves.toBeNull();
  });

  it("normaliza o id do provider Hemocione ID para bloodBanksLocationId", async () => {
    mocks.fetch.mockResolvedValue([
      {
        id: locationA,
        name: "Banco mapeado",
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
    ]);

    await expect(
      getNearbyOndeDoarBloodBanks(-23.5505, -46.6333),
    ).resolves.toEqual([
      expect.objectContaining({ bloodBanksLocationId: locationA }),
    ]);
  });

  it("valida o mesmo id normalizado no submit do interesse", async () => {
    mocks.fetch.mockResolvedValue([
      {
        id: locationA,
        name: "Banco mapeado",
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
    ]);

    await expect(getOndeDoarBloodBankByLocationId(locationA)).resolves.toEqual({
      bloodBanksLocationId: locationA,
      name: "Banco mapeado",
      origin: "ondedoar",
    });
    await expect(getOndeDoarBloodBankByLocationId(locationB)).resolves.toBeNull();
  });

  it("filtra por banco, raio fixo e ID canônico", async () => {
    mocks.fetch.mockResolvedValue([
      {
        id: locationA,
        name: "Banco próximo",
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
      {
        id: locationB,
        name: "Banco distante",
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-47.7, -23.56] },
      },
      {
        name: "Mesmo nome sem ID",
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
      {
        id: locationA,
        name: "Evento próximo",
        type: "event",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
    ]);

    const result = await getNearbyOndeDoarBloodBanks(-23.5505, -46.6333);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bloodBanksLocationId: locationA,
      name: "Banco próximo",
      origin: "ondedoar",
    });
    expect(result[0].distanceMeters).toBeGreaterThan(0);
    expect(result[0].distanceMeters).toBeLessThanOrEqual(50_000);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://ondedoar.example/api/v1/points",
      { method: "GET" },
    );
  });

  it("aceita o campo explícito bloodBanksLocationId sem fazer match por nome", async () => {
    mocks.fetch.mockResolvedValue([
      {
        bloodBanksLocationId: locationB,
        name: "Nome que não participa do match",
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
    ]);

    const result = await getNearbyOndeDoarBloodBanks(-23.5505, -46.6333);

    expect(result.map((point) => point.bloodBanksLocationId)).toEqual([locationB]);
  });

  it("rejeita ponto com id do provider divergente do campo canônico", async () => {
    mocks.fetch.mockResolvedValue([
      {
        id: locationA,
        bloodBanksLocationId: locationB,
        name: "Banco inconsistente",
        type: "bloodbank",
        loc: { type: "Point", coordinates: [-46.64, -23.56] },
      },
    ]);

    await expect(getNearbyOndeDoarBloodBanks(-23.5505, -46.6333)).resolves.toEqual([]);
  });

  it("retorna lista vazia quando a fonte não está configurada", async () => {
    mocks.config.ondedoarApiUrl = "";

    await expect(
      getNearbyOndeDoarBloodBanks(-23.5505, -46.6333),
    ).resolves.toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("degrada com segurança quando a fonte falha", async () => {
    mocks.fetch.mockRejectedValue(new Error("source unavailable"));

    await expect(
      getNearbyOndeDoarBloodBanks(-23.5505, -46.6333),
    ).resolves.toEqual([]);
  });
});
