import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O bug que estes testes cobrem nao estava na logica de auth, e sim na FIACAO:
 * `assertSecretAuth` existia, era importada pelo middleware e pelas duas rotas
 * de backoffice, e nunca era alcancada. O guard `if (!path.startsWith("/api/v1"))`
 * retornava antes, porque as rotas de backoffice vivem em `/api/backoffice/v1`.
 *
 * Testar a funcao de auth isolada passava verde com o backoffice aberto. O que
 * precisa de teste e o middleware decidindo, por path, qual checagem aplicar.
 */

const assertSecretAuth = vi.fn();
const useHemocioneUserAuth = vi.fn(() => ({ id: "user-1" }));

vi.mock("~/server/services/auth", () => ({
  assertSecretAuth: (...args: unknown[]) => assertSecretAuth(...args),
  useHemocioneUserAuth: (...args: unknown[]) => useHemocioneUserAuth(...args),
}));

interface FakeEvent {
  path: string;
  headers: { get: (name: string) => string | null };
  context: Record<string, unknown>;
}

function makeEvent(path: string, headers: Record<string, string> = {}): FakeEvent {
  const normalizados = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    path,
    headers: { get: (name: string) => normalizados[name.toLowerCase()] ?? null },
    context: {},
  };
}

let middleware: (event: FakeEvent) => unknown;

beforeAll(async () => {
  // O middleware chama `defineEventHandler` no topo do modulo, então os globais
  // precisam existir antes de importa-lo.
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("createError", (opts: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(opts.statusMessage), opts),
  );

  const mod = await import("~/server/middleware/auth");
  middleware = mod.default as (event: FakeEvent) => unknown;
});

beforeEach(() => {
  assertSecretAuth.mockReset();
  useHemocioneUserAuth.mockReset();
  useHemocioneUserAuth.mockReturnValue({ id: "user-1" });
});

describe("middleware de auth — rotas de backoffice", () => {
  const rotasDeBackoffice = [
    "/api/backoffice/v1/bloodbanks",
    "/api/backoffice/v1/bloodbanks/abc-123/collection-requests",
  ];

  it.each(rotasDeBackoffice)("exige o secret em %s", (path) => {
    middleware(makeEvent(path));

    // A assercao que pega o bug: antes, o middleware retornava sem nunca
    // chamar a checagem, e a rota criava hemocentro sem credencial.
    expect(assertSecretAuth).toHaveBeenCalledTimes(1);
  });

  it.each(rotasDeBackoffice)("não aplica o fluxo de JWT em %s", (path) => {
    middleware(makeEvent(path));

    expect(useHemocioneUserAuth).not.toHaveBeenCalled();
  });

  it("propaga a recusa quando o secret está errado", () => {
    assertSecretAuth.mockImplementation(() => {
      throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
    });

    expect(() => middleware(makeEvent("/api/backoffice/v1/bloodbanks"))).toThrow(
      "Unauthorized",
    );
  });

  it("não deixa passar sem checagem nenhuma", () => {
    // Sem secret configurado, o mock nao lanca — mas o que importa aqui é que a
    // decisao passou pela checagem, em vez de contornar o guard.
    middleware(makeEvent("/api/backoffice/v1/bloodbanks"));

    expect(assertSecretAuth).toHaveBeenCalled();
    expect(useHemocioneUserAuth).not.toHaveBeenCalled();
  });
});

describe("middleware de auth — demais rotas", () => {
  it("libera as rotas públicas sem nenhuma checagem", () => {
    middleware(makeEvent("/api/v1/public/bloodbanks"));

    expect(assertSecretAuth).not.toHaveBeenCalled();
    expect(useHemocioneUserAuth).not.toHaveBeenCalled();
  });

  it("ignora o que não é rota de API", () => {
    middleware(makeEvent("/agendar"));

    expect(assertSecretAuth).not.toHaveBeenCalled();
    expect(useHemocioneUserAuth).not.toHaveBeenCalled();
  });

  it("recusa rota autenticada sem Authorization", () => {
    expect(() => middleware(makeEvent("/api/v1/bloodbank/abc/dashboard"))).toThrow(
      "Unauthorized - Missing Token",
    );
    expect(useHemocioneUserAuth).not.toHaveBeenCalled();
  });

  it("aplica o fluxo de JWT na rota autenticada e popula o contexto", () => {
    const event = makeEvent("/api/v1/bloodbank/abc/dashboard", {
      Authorization: "Bearer token-de-teste",
    });

    middleware(event);

    expect(assertSecretAuth).not.toHaveBeenCalled();
    expect(useHemocioneUserAuth).toHaveBeenCalledTimes(1);
    expect(event.context.auth).toEqual({
      token: "token-de-teste",
      user: { id: "user-1" },
    });
  });

  it("não confunde um path que apenas contém 'backoffice' depois de /api/v1", () => {
    // `/api/v1/backoffice-relatorio` não é rota de backoffice: precisa seguir
    // pelo fluxo de JWT, não pelo secret.
    expect(() =>
      middleware(makeEvent("/api/v1/backoffice-relatorio")),
    ).toThrow("Unauthorized - Missing Token");
    expect(assertSecretAuth).not.toHaveBeenCalled();
  });
});
