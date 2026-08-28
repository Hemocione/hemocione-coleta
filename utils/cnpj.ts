export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function normalizeCnpj(value: string): string {
  return (value || "")
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase();
}

export function formatCnpj(value: string): string {
  const cnpj = normalizeCnpj(value).slice(0, 14);
  let formatted = cnpj.slice(0, 2);
  if (cnpj.length > 2) formatted += `.${cnpj.slice(2, 5)}`;
  if (cnpj.length > 5) formatted += `.${cnpj.slice(5, 8)}`;
  if (cnpj.length > 8) formatted += `/${cnpj.slice(8, 12)}`;
  if (cnpj.length > 12) formatted += `-${cnpj.slice(12)}`;
  return formatted;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (cnpj.length !== 14) return false;
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) return false;
  if (/^([A-Z0-9])\1{11}/.test(cnpj)) return false;

  const characterValue = (character: string) =>
    /[A-Z]/.test(character)
      ? character.charCodeAt(0) - 48
      : Number(character);
  const checkDigit = (base: string, weights: number[]) => {
    const sum = [...base].reduce(
      (total, character, index) =>
        total + characterValue(character) * weights[index],
      0,
    );
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = checkDigit(cnpj.slice(0, 12), [
    5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
  const d2 = checkDigit(cnpj.slice(0, 12) + String(d1), [
    6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
  ]);
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}
