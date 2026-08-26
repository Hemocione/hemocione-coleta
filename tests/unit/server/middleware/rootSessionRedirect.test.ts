import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h3Mocks = vi.hoisted(() => ({
  getCookie: vi.fn(),
  sendRedirect: vi.fn(),
}));

vi.mock("h3", () => ({
  getCookie: (...args: unknown[]) => h3Mocks.getCookie(...args),
  sendRedirect: (...args: unknown[]) => h3Mocks.sendRedirect(...args),
}));

const verifyAndReturnData = vi.hoisted(() => vi.fn());

vi.mock("~/server/services/jwt", () => ({
  verifyAndReturnData: (...args: unknown[]) => verifyAndReturnData(...args),
}));

interface FakeEvent {
  path: string;
}

let middleware: (event: FakeEvent) => unknown;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { authCookieKey: "devHemocioneId" },
  }));

  const mod = await import("~/server/middleware/root-session-redirect");
  middleware = mod.default as (event: FakeEvent) => unknown;
});

beforeEach(() => {
  h3Mocks.getCookie.mockReset();
  h3Mocks.sendRedirect.mockReset();
  verifyAndReturnData.mockReset();
});

describe("middleware root-session-redirect", () => {
  it("redireciona / para /agendar quando o cookie de sessão é válido", () => {
    h3Mocks.getCookie.mockReturnValue("token-valido");
    h3Mocks.sendRedirect.mockReturnValue("redirected");

    const result = middleware({ path: "/" });

    expect(verifyAndReturnData).toHaveBeenCalledWith("token-valido");
    expect(h3Mocks.sendRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/" }),
      "/agendar",
      302,
    );
    expect(result).toBe("redirected");
  });

  it("ignora query string ao avaliar a rota raiz", () => {
    h3Mocks.getCookie.mockReturnValue("token-valido");
    h3Mocks.sendRedirect.mockReturnValue("redirected");

    middleware({ path: "/?utm_source=x" });

    expect(h3Mocks.sendRedirect).toHaveBeenCalled();
  });

  it("não redireciona sem cookie de sessão", () => {
    h3Mocks.getCookie.mockReturnValue(undefined);

    const result = middleware({ path: "/" });

    expect(verifyAndReturnData).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("não redireciona com token inválido ou expirado", () => {
    h3Mocks.getCookie.mockReturnValue("token-invalido");
    verifyAndReturnData.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const result = middleware({ path: "/" });

    expect(result).toBeUndefined();
    expect(h3Mocks.sendRedirect).not.toHaveBeenCalled();
  });

  it("só se aplica à rota raiz", () => {
    const result = middleware({ path: "/agendar" });

    expect(h3Mocks.getCookie).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
