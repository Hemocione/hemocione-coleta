import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicUrl, getPublicBaseUrl } from "~/utils/publicUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public URL", () => {
  it("uses the configured base URL without a trailing slash", () => {
    vi.stubEnv("NUXT_PUBLIC_BASE_URL", "https://coleta.example.com/");

    expect(getPublicBaseUrl()).toBe("https://coleta.example.com");
    expect(buildPublicUrl("/agendar/acompanhar/token-a")).toBe(
      "https://coleta.example.com/agendar/acompanhar/token-a"
    );
  });

  it("uses the canonical production URL when the public base URL is absent", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NUXT_PUBLIC_BASE_URL", "");

    expect(buildPublicUrl("/agendar/acompanhar/token-a")).toBe(
      "https://coleta.hemocione.com.br/agendar/acompanhar/token-a"
    );
  });

  it("uses the Vercel preview hostname outside production", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "coleta-preview.vercel.app");

    expect(getPublicBaseUrl()).toBe("https://coleta-preview.vercel.app");
  });
});
