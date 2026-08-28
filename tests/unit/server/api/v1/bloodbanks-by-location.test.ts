import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bloodBankFind: vi.fn(),
}));

vi.mock("~/server/models", () => ({
  bloodBank: {
    BloodBank: {
      find: (...args: unknown[]) => mocks.bloodBankFind(...args),
    },
  },
}));

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
  mocks.bloodBankFind.mockReset();
  const exec = vi.fn().mockResolvedValue([
    {
      _id: { toString: () => "bank-id" },
      name: "Banco visível",
      slug: "banco-visivel",
      logo: null,
      bloodBanksLocationId: { toString: () => "location-id" },
      location: { coordinates: [-46.6333, -23.5505] },
    },
  ]);
  mocks.bloodBankFind.mockReturnValue({ lean: () => ({ exec }) });
});

describe("GET /api/v1/bloodbanks/by-location", () => {
  it("não lista bancos marcados como hidden", async () => {
    const response = await handler({ query: { lat: "-23.5505", lng: "-46.6333" } });

    expect(mocks.bloodBankFind).toHaveBeenCalledWith(
      {
        active: true,
        hidden: { $ne: true },
        coverageArea: {
          $geoIntersects: {
            $geometry: {
              type: "Point",
              coordinates: [-46.6333, -23.5505],
            },
          },
        },
      },
      { name: 1, slug: 1, logo: 1, bloodBanksLocationId: 1, location: 1 },
    );
    expect(response).toMatchObject({
      success: true,
      data: [{ slug: "banco-visivel" }],
    });
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
