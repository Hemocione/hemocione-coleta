import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMITMENT_TERM_TEMPLATE,
  renderTemplate,
} from "~/server/services/commitmentTerm";

describe("template do termo de compromisso", () => {
  it("renderiza o placeholder legado Grupo Pulsa com o nome do banco", () => {
    expect(
      renderTemplate("Banco responsável: {{Grupo Pulsa}}", {
        bloodBankName: "Hemodemo",
      })
    ).toBe("Banco responsável: Hemodemo");
  });

  it("mantém somente placeholders suportados no template padrão", () => {
    expect(DEFAULT_COMMITMENT_TERM_TEMPLATE).not.toContain("{{Grupo Pulsa}}");
  });
});
