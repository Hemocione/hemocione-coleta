import { describe, expect, it } from "vitest";
import { CommitmentTermSchema } from "~/server/models/commitmentTerm";
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

  it("mantém a assinatura identificada opcional no schema", () => {
    expect(CommitmentTermSchema.path("signedByName").options).toMatchObject({
      required: false,
      default: null,
    });
    expect(CommitmentTermSchema.path("signedAt").options).toMatchObject({
      required: false,
      default: null,
    });
  });
});
