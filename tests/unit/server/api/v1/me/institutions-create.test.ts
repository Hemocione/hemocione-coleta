import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInstitution: vi.fn(),
}));

vi.mock("~/server/services/hemocioneId", () => ({
  createInstitution: (...args: unknown[]) => mocks.createInstitution(...args),
}));

interface FakeEvent {
  context: { auth?: { token?: string } };
  body: unknown;
}

let handler: (event: FakeEvent) => Promise<unknown>;

const token = "jwt-token";
const body = {
  name: "Instituição A",
  legalName: "Instituição A Ltda.",
  document: "11222333000181",
  kind: "company",
  address: "Rua A, 1",
  phone: "+5511999999999",
  city: "São Paulo",
  state: "SP",
  logo: "https://cdn.hemocione.com.br/events/dev/uploads/users/logo.png",
};

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (eventHandler: unknown) => eventHandler);
  vi.stubGlobal("readBody", (event: FakeEvent) => event.body);
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options)
  );
  const mod = await import("~/server/api/v1/me/institutions/index.post");
  handler = mod.default as typeof handler;
});

beforeEach(() => {
  mocks.createInstitution.mockReset();
  mocks.createInstitution.mockResolvedValue({ id: "institution-a", ...body });
});

describe("POST /api/v1/me/institutions", () => {
  it("forwards the uploaded CDN logo during institution creation", async () => {
    await expect(
      handler({ context: { auth: { token } }, body })
    ).resolves.toEqual({ id: "institution-a", ...body });

    expect(mocks.createInstitution).toHaveBeenCalledWith(token, body);
  });

  it("rejects a logo outside the Hemocione CDN", async () => {
    await expect(
      handler({
        context: { auth: { token } },
        body: { ...body, logo: "https://example.test/logo.png" },
      })
    ).rejects.toThrow();
    expect(mocks.createInstitution).not.toHaveBeenCalled();
  });
});
