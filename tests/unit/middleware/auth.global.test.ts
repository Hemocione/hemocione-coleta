import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    user: null as Record<string, unknown> | null,
    token: null as string | null,
    userHasBloodBankRole: false,
    firstBloodBankSlug: null as string | null,
    allBloodBankSlugs: [] as string[],
  };

  return {
    state,
    userStore: {
      get user() {
        return state.user;
      },
      get token() {
        return state.token;
      },
      get userHasBloodBankRole() {
        return state.userHasBloodBankRole;
      },
      get firstBloodBankSlug() {
        return state.firstBloodBankSlug;
      },
      get allBloodBankSlugs() {
        return state.allBloodBankSlugs;
      },
      setUser: vi.fn((user: Record<string, unknown> | null) => {
        state.user = user;
      }),
      setToken: vi.fn((token: string | null) => {
        state.token = token;
      }),
    },
    fetch: vi.fn(),
    navigateTo: vi.fn(),
    useCookie: vi.fn(),
    cookie: { value: null as string | null },
  };
});

vi.mock("~/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

let authMiddleware: (to: unknown, from: unknown) => Promise<unknown>;
let redirectToID: (fullPath: string) => Promise<unknown>;
let evaluateCurrentLogin: (query?: Record<string, unknown>) => Promise<boolean>;
let isPublicRoute: (route: string) => boolean;

beforeAll(async () => {
  vi.stubGlobal("defineNuxtRouteMiddleware", (handler: unknown) => handler);

  const authModule = await import("~/middleware/auth.global");
  authMiddleware = authModule.default as typeof authMiddleware;
  evaluateCurrentLogin = authModule.evaluateCurrentLogin as typeof evaluateCurrentLogin;
  isPublicRoute = authModule.isPublicRoute;

  const redirectModule = await import("~/utils/redirectToID");
  redirectToID = redirectModule.redirectToID;
});

beforeEach(() => {
  Object.assign(mocks.state, {
    user: null,
    token: null,
    userHasBloodBankRole: false,
    firstBloodBankSlug: null,
    allBloodBankSlugs: [],
  });
  mocks.fetch.mockReset();
  mocks.navigateTo.mockReset();
  mocks.useCookie.mockReset();
  mocks.cookie.value = null;
  mocks.useCookie.mockReturnValue(mocks.cookie);
  mocks.navigateTo.mockImplementation((path: string, options: unknown) => ({
    path,
    options,
  }));

  vi.stubGlobal("$fetch", mocks.fetch);
  vi.stubGlobal("navigateTo", mocks.navigateTo);
  vi.stubGlobal("useCookie", mocks.useCookie);
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: {
      authCookieKey: "auth-cookie",
      hemocioneIdApiUrl: "https://id.example.test",
      hemocioneIdUrl: "https://id.example.test/login",
      siteUrl: "http://localhost:3000",
    },
  }));
});

describe("middleware global de autenticação", () => {
  it("autentica o token retornado pelo Hemocione ID e navega para /agendar", async () => {
    const user = { id: "user-1", givenName: "Teste", bloodBankRoles: [] };
    mocks.fetch
      .mockResolvedValueOnce({ valid: true })
      .mockResolvedValueOnce(user);

    await authMiddleware(
      {
        path: "/",
        fullPath: "/?token=token-de-retorno",
        query: { token: "token-de-retorno" },
        params: {},
      },
      { query: {} },
    );

    expect(mocks.state.user).toEqual(user);
    expect(mocks.state.token).toBe("token-de-retorno");
    expect(mocks.cookie.value).toBe("token-de-retorno");
    expect(mocks.useCookie).toHaveBeenCalledWith("auth-cookie");
    expect(mocks.navigateTo).toHaveBeenCalledWith("/agendar", {
      replace: true,
    });
  });

  it("não persiste um token inválido no cookie", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("token inválido"));

    await authMiddleware(
      {
        path: "/",
        fullPath: "/?token=token-invalido",
        query: { token: "token-invalido" },
        params: {},
      },
      { query: {} },
    );

    expect(mocks.cookie.value).toBeNull();
    expect(mocks.state.user).toBeNull();
    expect(mocks.state.token).toBeNull();
  });

  it("mantém /agendar público quando não existe sessão", async () => {
    await authMiddleware(
      {
        path: "/agendar",
        fullPath: "/agendar",
        query: {},
        params: {},
      },
      { query: {} },
    );

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("mantém /termo/:token público quando não existe sessão", async () => {
    await authMiddleware(
      {
        path: "/termo/token-publico",
        fullPath: "/termo/token-publico",
        query: {},
        params: { token: "token-publico" },
      },
      { query: {} },
    );

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("não trata um prefixo parecido como rota pública", () => {
    expect(isPublicRoute("/termo-privado")).toBe(false);
  });

  it.each([false, { valid: false }])(
    "rejeita a resposta explícita de validação %o",
    async (validationResponse) => {
      mocks.fetch.mockImplementation((url: string) => {
        if (url.endsWith("/users/validate-token")) {
          return validationResponse;
        }

        return { id: "user-inesperado", bloodBankRoles: [] };
      });

      const result = await evaluateCurrentLogin({ token: "token-invalido" });

      expect(result).toBe(false);
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      expect(mocks.state.user).toBeNull();
      expect(mocks.state.token).toBeNull();
    },
  );

  it("remove o token do callback e preserva a origem configurada fora do desenvolvimento", async () => {
    await redirectToID("/?token=token-invalido&foo=bar");

    expect(mocks.navigateTo).toHaveBeenCalledWith(
      "https://id.example.test/login?redirect=http%3A%2F%2Flocalhost%3A3000%2F%3Ffoo%3Dbar",
      { external: true },
    );
  });
});
