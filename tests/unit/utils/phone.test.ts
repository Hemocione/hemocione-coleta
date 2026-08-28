import { describe, expect, it } from "vitest";
import { formatBrazilPhone, isValidBrazilPhone } from "~/utils/phone";

describe("formatBrazilPhone", () => {
  it("formats a mobile phone with the +55 prefix", () => {
    expect(formatBrazilPhone("11999999999")).toBe("+55 (11) 99999-9999");
  });

  it("formats a landline phone with the +55 prefix", () => {
    expect(formatBrazilPhone("1133334444")).toBe("+55 (11) 3333-4444");
  });

  it("keeps a local number with DDD 55", () => {
    expect(formatBrazilPhone("5533334444")).toBe("+55 (55) 3333-4444");
  });

  it("keeps the country prefix when the field is empty", () => {
    expect(formatBrazilPhone("")).toBe("+55 ");
  });
});

describe("isValidBrazilPhone", () => {
  it("accepts mobile and landline numbers", () => {
    expect(isValidBrazilPhone("+55 (11) 99999-9999")).toBe(true);
    expect(isValidBrazilPhone("+55 (11) 3333-4444")).toBe(true);
  });

  it("rejects a number without the Brazilian country code", () => {
    expect(isValidBrazilPhone("(11) 99999-9999")).toBe(false);
  });
});
