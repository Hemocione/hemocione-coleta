import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getNearbyBloodBanks: vi.fn(),
}));

vi.mock("~/server/services/nearbyBloodBanks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/server/services/nearbyBloodBanks")>();
  return {
    ...actual,
    getNearbyBloodBanks: (...args: unknown[]) =>
      mocks.getNearbyBloodBanks(...args),
  };
});

interface FakeEvent {
  query: Record<string, string>;
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal("getQuery", (event: FakeEvent) => event.query);

  const mod = await import("~/server/api/v1/bloodbanks/by-location.get");
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.getNearbyBloodBanks.mockReset().mockResolvedValue([
    {
      _id: { toString: () => "bank-id" },
      name: "Banco visível",
      slug: "banco-visivel",
      logo: null,
      bloodBanksLocationId: { toString: () => "location-id" },
      location: { coordinates: [-46.6333, -23.5505] },
      availability: "active",
    },
  ]);
});

describe("GET /api/v1/bloodbanks/by-location", () => {
  it("não lista bancos marcados como hidden", async () => {
    const response = await handler({ query: { lat: "-23.5505", lng: "-46.6333" } });

    expect(mocks.getNearbyBloodBanks).toHaveBeenCalledWith(-23.5505, -46.6333);
    expect(response).toMatchObject({
      success: true,
      data: [{ slug: "banco-visivel" }],
    });
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
