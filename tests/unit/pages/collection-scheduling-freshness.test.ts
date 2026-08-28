import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = "pages/agendar/[bloodbankSlug]/index.vue";

describe("freshness do fluxo de criação de coleta", () => {
  it("usa fetchWithAuth direto nas cargas imperativas", () => {
    const source = readFileSync(resolve(process.cwd(), pagePath), "utf8");

    expect(source).not.toContain("useFetchWithAuth");
    expect(source.match(/await fetchWithAuth/g)).toHaveLength(4);
  });
});
