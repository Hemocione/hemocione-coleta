import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getNearbyBloodBanks = vi.fn();

vi.mock("~/server/services/nearbyBloodBanks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/services/nearbyBloodBanks")>();
  return {
    ...actual,
    getNearbyBloodBanks: (...args: unknown[]) => getNearbyBloodBanks(...args),
  };
});

interface FakeEvent {
  query: Record<string, unknown>;
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal("getQuery", (event: FakeEvent) => event.query);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );

  const mod = await import("~/server/api/v1/public/bloodbanks/by-location.get");
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  getNearbyBloodBanks.mockReset().mockResolvedValue([
    {
      bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Banco A",
      availability: "active",
    },
  ]);
});

describe("GET /api/v1/public/bloodbanks/by-location", () => {
  it("retorna o catálogo unificado", async () => {
    await expect(
      handler({ query: { lat: "-23.5505", lng: "-46.6333" } }),
    ).resolves.toEqual({
      success: true,
      data: [
        {
          bloodBanksLocationId: "123e4567-e89b-12d3-a456-426614174000",
          name: "Banco A",
          availability: "active",
        },
      ],
    });
    expect(getNearbyBloodBanks).toHaveBeenCalledWith(-23.5505, -46.6333);
  });

  it("valida coordenadas ausentes e fora do limite", async () => {
    await expect(handler({ query: { lat: "", lng: "-46.6333" } })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(handler({ query: { lat: "-23.5505", lng: "181" } })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(getNearbyBloodBanks).not.toHaveBeenCalled();
  });
});
