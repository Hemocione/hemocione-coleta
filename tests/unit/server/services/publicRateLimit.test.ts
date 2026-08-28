import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequestIP: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("h3", () => ({
  getRequestIP: (...args: unknown[]) => mocks.getRequestIP(...args),
  setResponseHeader: (...args: unknown[]) => mocks.setResponseHeader(...args),
}));

interface FakeEvent {
  headers: { get: (name: string) => string | null };
}

type EnforcePublicRateLimit =
  typeof import("~/server/services/publicRateLimit")["enforcePublicRateLimit"];
let enforcePublicRateLimit: EnforcePublicRateLimit;

function makeEvent(): FakeEvent {
  return { headers: { get: () => null } };
}

beforeAll(async () => {
  vi.stubGlobal(
    "createError",
    (options: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(options.statusMessage), options),
  );
  ({ enforcePublicRateLimit } = await import("~/server/services/publicRateLimit"));
});

beforeEach(() => {
  mocks.getRequestIP.mockReset();
  mocks.setResponseHeader.mockReset();
});

describe("rate limit público em memória", () => {
  it("permite até 10 tentativas por IP na janela", () => {
    mocks.getRequestIP.mockReturnValue("198.51.100.10");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(() =>
        enforcePublicRateLimit(makeEvent() as never, "bloodbank-interest"),
      ).not.toThrow();
    }

    expect(mocks.setResponseHeader).toHaveBeenCalledWith(
      expect.anything(),
      "x-ratelimit-limit",
      "10",
    );
    expect(mocks.setResponseHeader).toHaveBeenCalledWith(
      expect.anything(),
      "x-ratelimit-remaining",
      "0",
    );
  });

  it("bloqueia a 11ª tentativa e informa quando tentar novamente", () => {
    mocks.getRequestIP.mockReturnValue("198.51.100.11");
    const event = makeEvent();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      enforcePublicRateLimit(event as never, "bloodbank-interest");
    }

    expect(() =>
      enforcePublicRateLimit(event as never, "bloodbank-interest"),
    ).toThrowError("Too many requests");
    expect(mocks.setResponseHeader).toHaveBeenCalledWith(
      event,
      "retry-after",
      expect.stringMatching(/^\d+$/),
    );
  });

  it("separa contadores por IP e por escopo", () => {
    mocks.getRequestIP.mockReturnValue("198.51.100.12");

    expect(() =>
      enforcePublicRateLimit(makeEvent() as never, "bloodbank-interest"),
    ).not.toThrow();
    expect(() =>
      enforcePublicRateLimit(makeEvent() as never, "other-public-action"),
    ).not.toThrow();

    mocks.getRequestIP.mockReturnValue("198.51.100.13");
    expect(() =>
      enforcePublicRateLimit(makeEvent() as never, "bloodbank-interest"),
    ).not.toThrow();
  });

  it("falha fechado quando não consegue identificar o IP", () => {
    mocks.getRequestIP.mockReturnValue(undefined);

    expect(() =>
      enforcePublicRateLimit(makeEvent() as never, "bloodbank-interest"),
    ).toThrowError("Rate limit unavailable");
  });
});
