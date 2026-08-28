import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bloodBankFind: vi.fn(),
  getNearbyOndeDoarBloodBanks: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  bloodBank: {
    BloodBank: {
      find: (...args: unknown[]) => mocks.bloodBankFind(...args),
    },
  },
}));

vi.mock("~/server/services/ondeDoar", () => ({
  getNearbyOndeDoarBloodBanks: (...args: unknown[]) =>
    mocks.getNearbyOndeDoarBloodBanks(...args),
}));

const locationActive = "123e4567-e89b-12d3-a456-426614174000";
const locationInactive = "123e4567-e89b-12d3-a456-426614174001";
const locationMissing = "123e4567-e89b-12d3-a456-426614174002";
const locationHidden = "123e4567-e89b-12d3-a456-426614174003";

function chainable<T>(value: T) {
  return {
    lean: () => ({ exec: () => Promise.resolve(value) }),
  };
}

beforeEach(() => {
  mocks.bloodBankFind.mockReset();
  mocks.getNearbyOndeDoarBloodBanks.mockReset();
  mocks.bloodBankFind
    .mockReturnValueOnce(
      chainable([
        {
          _id: "local-active-id",
          name: "Banco ativo local",
          slug: "banco-ativo-local",
          bloodBanksLocationId: locationActive,
          logo: "logo.png",
          active: true,
          hidden: false,
          location: { coordinates: [-46.64, -23.56] },
        },
      ]),
    )
    .mockReturnValueOnce(
      chainable([
        {
          _id: "local-active-id",
          name: "Banco ativo local",
          slug: "banco-ativo-local",
          bloodBanksLocationId: locationActive,
          logo: "logo.png",
          active: true,
          hidden: false,
        },
        {
          _id: "local-inactive-id",
          name: "Banco inativo local",
          slug: "banco-inativo-local",
          bloodBanksLocationId: locationInactive,
          logo: null,
          active: false,
          hidden: false,
        },
        {
          _id: "local-hidden-id",
          name: "Banco oculto local",
          slug: "banco-oculto-local",
          bloodBanksLocationId: locationHidden,
          logo: null,
          active: true,
          hidden: true,
        },
      ]),
    );
  mocks.getNearbyOndeDoarBloodBanks.mockResolvedValue([
    {
      bloodBanksLocationId: locationActive,
      name: "Nome externo ativo",
      origin: "ondedoar",
      distanceMeters: 1_200,
    },
    {
      bloodBanksLocationId: locationInactive,
      name: "Nome externo inativo",
      origin: "ondedoar",
      distanceMeters: 2_300,
    },
    {
      bloodBanksLocationId: locationMissing,
      name: "Banco ainda não cadastrado",
      origin: "ondedoar",
      distanceMeters: 3_400,
    },
    {
      bloodBanksLocationId: locationHidden,
      name: "Banco oculto externo",
      origin: "ondedoar",
      distanceMeters: 4_500,
    },
  ]);
});

describe("listagem unificada de bancos próximos", () => {
  it("prioriza bancos com agenda antes da distância", async () => {
    mocks.bloodBankFind
      .mockReset()
      .mockReturnValueOnce(
        chainable([
          {
            _id: "local-active-id",
            name: "Banco ativo distante",
            slug: "banco-ativo-distante",
            bloodBanksLocationId: locationActive,
            logo: null,
            active: true,
            hidden: false,
            location: { coordinates: [-46.9, -23.9] },
          },
        ]),
      )
      .mockReturnValueOnce(
        chainable([
          {
            _id: "local-inactive-id",
            name: "Banco inativo próximo",
            slug: "banco-inativo-proximo",
            bloodBanksLocationId: locationInactive,
            logo: null,
            active: false,
            hidden: false,
          },
        ]),
      );
    mocks.getNearbyOndeDoarBloodBanks.mockResolvedValue([
      {
        bloodBanksLocationId: locationInactive,
        name: "Banco inativo próximo",
        origin: "ondedoar",
        distanceMeters: 100,
      },
      {
        bloodBanksLocationId: locationMissing,
        name: "Banco ainda não cadastrado",
        origin: "ondedoar",
        distanceMeters: 200,
      },
    ]);
    const { getNearbyBloodBanks } = await import("~/server/services/nearbyBloodBanks");

    await expect(getNearbyBloodBanks(-23.5505, -46.6333)).resolves.toEqual([
      expect.objectContaining({
        bloodBanksLocationId: locationActive,
        availability: "active",
      }),
      expect.objectContaining({
        bloodBanksLocationId: locationInactive,
        availability: "inactive",
      }),
      expect.objectContaining({
        bloodBanksLocationId: locationMissing,
        availability: "missing",
      }),
    ]);
  });

  it("une OndeDoar e Coleta por bloodBanksLocationId", async () => {
    const { getNearbyBloodBanks } = await import("~/server/services/nearbyBloodBanks");

    const result = await getNearbyBloodBanks(-23.5505, -46.6333);

    expect(result).toEqual([
      expect.objectContaining({
        bloodBanksLocationId: locationActive,
        name: "Banco ativo local",
        slug: "banco-ativo-local",
        availability: "active",
      }),
      expect.objectContaining({
        bloodBanksLocationId: locationInactive,
        name: "Banco inativo local",
        slug: null,
        availability: "inactive",
      }),
      expect.objectContaining({
        bloodBanksLocationId: locationMissing,
        name: "Banco ainda não cadastrado",
        slug: null,
        availability: "missing",
      }),
    ]);
    expect(mocks.bloodBankFind).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ hidden: { $ne: true } }),
      expect.objectContaining({ hidden: 1 }),
    );
    expect(mocks.bloodBankFind).toHaveBeenNthCalledWith(
      2,
      { bloodBanksLocationId: { $in: [locationActive, locationInactive, locationMissing, locationHidden] } },
      { name: 1, slug: 1, logo: 1, bloodBanksLocationId: 1, active: 1, hidden: 1 },
    );
    expect(result).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bloodBanksLocationId: locationHidden }),
      ]),
    );
  });

  it("mantém bancos ativos do Coleta quando a fonte externa falha", async () => {
    mocks.getNearbyOndeDoarBloodBanks.mockResolvedValue([]);
    const { getNearbyBloodBanks } = await import("~/server/services/nearbyBloodBanks");

    await expect(getNearbyBloodBanks(-23.5505, -46.6333)).resolves.toEqual([
      expect.objectContaining({
        bloodBanksLocationId: locationActive,
        availability: "active",
      }),
    ]);
    expect(mocks.bloodBankFind).toHaveBeenCalledTimes(1);
  });

  it("mantém active quando o match local não está na cobertura da primeira busca", async () => {
    mocks.bloodBankFind
      .mockReset()
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(
        chainable([
          {
            _id: "local-active-id",
            name: "Banco ativo local",
            slug: "banco-ativo-local",
            bloodBanksLocationId: locationActive,
            logo: "logo.png",
            active: true,
            hidden: false,
          },
        ]),
      );
    mocks.getNearbyOndeDoarBloodBanks.mockResolvedValue([
      {
        bloodBanksLocationId: locationActive,
        name: "Nome externo ativo",
        origin: "ondedoar",
        distanceMeters: 1_200,
      },
    ]);
    const { getNearbyBloodBanks } = await import("~/server/services/nearbyBloodBanks");

    await expect(getNearbyBloodBanks(-23.5505, -46.6333)).resolves.toEqual([
      expect.objectContaining({
        bloodBanksLocationId: locationActive,
        availability: "active",
        slug: "banco-ativo-local",
      }),
    ]);
  });
});
