const LEGACY_PLACEHOLDER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\{\{\s*Grupo Pulsa\s*\}\}/gi, "{{bloodBankName}}"],
];

export function normalizeCommitmentTermTemplate(template: string): string {
  return LEGACY_PLACEHOLDER_REPLACEMENTS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    template
  );
}
