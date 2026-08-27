import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

describe("public scheduling page accessibility contract", () => {
  it("sets Brazilian Portuguese as the document language", () => {
    const appSource = readProjectFile("app.vue");

    expect(appSource).toMatch(/htmlAttrs:\s*\{\s*lang:\s*["']pt-BR["']/s);
  });

  it("has one useful page heading", () => {
    const publicPageSource = [
      readProjectFile("layouts/agendamento.vue"),
      readProjectFile("pages/agendar/index.vue"),
    ].join("\n");

    expect(publicPageSource.match(/<h1\b/g)).toHaveLength(1);
    expect(publicPageSource).toContain(
      '<h1 class="font-semibold">Agendar Coleta</h1>'
    );
  });

  it("gives the authentication modal an accessible title and description", () => {
    const layoutSource = readProjectFile("layouts/agendamento.vue");

    expect(layoutSource).toMatch(
      /<UModal\s+v-model:open="loginPromptOpen"\s+title="Entre para continuar"\s+description="Para registrar ou selecionar uma instituição, você precisa estar logado\."/s
    );
  });
});
