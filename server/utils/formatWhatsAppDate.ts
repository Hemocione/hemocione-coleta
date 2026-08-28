export function formatWhatsAppDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "string") {
    const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateMatch) {
      return `${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
    }

    const brazilianDateMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brazilianDateMatch) {
      return `${brazilianDateMatch[1].padStart(2, "0")}/${brazilianDateMatch[2].padStart(2, "0")}/${brazilianDateMatch[3]}`;
    }
  }

  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return String(value);

  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear(),
  ].join("/");
}
