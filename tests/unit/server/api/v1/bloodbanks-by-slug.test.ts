import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveBloodBankBySlug: vi.fn(),
}));

vi.mock("~/server/services/bloodBank", () => ({
  getActiveBloodBankBySlug: (...args: unknown[]) =>
    mocks.getActiveBloodBankBySlug(...args),
}));

interface FakeEvent {
  context: {
    params: Record<string, string>;
  };
}

let handler: (event: FakeEvent) => Promise<unknown>;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal(
    "getRouterParam",
    (event: FakeEvent, name: string) => event.context.params[name],
  );
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );

  const mod = await import("~/server/api/v1/bloodbanks/[slug]/index.get");
  handler = mod.default as (event: FakeEvent) => Promise<unknown>;
});

beforeEach(() => {
  mocks.getActiveBloodBankBySlug.mockReset();
  mocks.getActiveBloodBankBySlug.mockResolvedValue({
    _id: { toString: () => "bank-id" },
    name: "Banco de teste",
    slug: "banco-de-teste",
    logo: null,
    bloodBanksLocationId: { toString: () => "location-id" },
    hidden: true,
  });
});

describe("GET /api/v1/bloodbanks/:slug", () => {
  it("mantém acesso direto ao banco ativo mesmo quando hidden", async () => {
    const response = await handler({
      context: { params: { slug: "banco-de-teste" } },
    });

    expect(response).toEqual({
      success: true,
      data: {
        _id: "bank-id",
        name: "Banco de teste",
        slug: "banco-de-teste",
        logo: null,
        bloodBanksLocationId: "location-id",
      },
    });
    expect(mocks.getActiveBloodBankBySlug).toHaveBeenCalledWith(
      "banco-de-teste",
    );
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});
