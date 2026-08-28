import { onlyDigits } from "~/utils/cnpj";

function localDigits(value: string): string {
  const digits = onlyDigits(value);
  const hasExplicitCountryCode = /^\s*\+?\s*55(?:\D|$)/.test(value);
  const hasCountryCodeByLength = digits.length > 11;
  const normalized =
    hasExplicitCountryCode || hasCountryCodeByLength
      ? digits.slice(2)
      : digits;
  return normalized.slice(0, 11);
}

export function formatBrazilPhone(value: string): string {
  const digits = localDigits(value);
  if (!digits) return "+55 ";

  const areaCode = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  if (digits.length <= 2) return `+55 (${areaCode}`;
  if (subscriber.length <= 4) return `+55 (${areaCode}) ${subscriber}`;
  if (subscriber.length <= 8) {
    return `+55 (${areaCode}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
  }
  return `+55 (${areaCode}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`;
}

export function isValidBrazilPhone(value: string): boolean {
  const digits = onlyDigits(value);
  return /^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(digits);
}
