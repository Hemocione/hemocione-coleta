import { describe, expect, it } from "vitest";
import { formatWhatsAppDate } from "~/server/utils/formatWhatsAppDate";

describe("formatWhatsAppDate", () => {
  it.each([
    ["2026-09-10", "10/09/2026"],
    ["2026-09-10T00:00:00.000Z", "10/09/2026"],
    ["10/09/2026", "10/09/2026"],
    ["1/9/2026", "01/09/2026"],
  ])("converte %s para %s", (value, expected) => {
    expect(formatWhatsAppDate(value)).toBe(expected);
  });

  it("retorna valor vazio sem inventar uma data", () => {
    expect(formatWhatsAppDate(undefined)).toBe("");
  });
});
