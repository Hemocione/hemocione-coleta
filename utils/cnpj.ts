export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const checkDigit = (base: string) => {
    let weight = base.length - 7;
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = checkDigit(cnpj.slice(0, 12));
  const d2 = checkDigit(cnpj.slice(0, 12) + String(d1));
  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}
