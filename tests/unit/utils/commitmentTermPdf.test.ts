import { describe, expect, it } from "vitest";
import { createCommitmentTermPdf } from "~/server/utils/commitmentTermPdf";

describe("PDF do termo de compromisso", () => {
  it("gera um documento PDF válido com o conteúdo do termo", () => {
    const pdf = createCommitmentTermPdf("TERMO DE COMPROMISSO\nHemodemo");
    const header = new TextDecoder().decode(pdf.slice(0, 8));

    expect(header).toBe("%PDF-1.4");
    expect(pdf.byteLength).toBeGreaterThan(100);
  });
});
