export type BloodbankSlugAccessDecision =
  | { kind: 'pass' }
  | { kind: 'redirectToId'; redirectPath: string }
  | { kind: 'navigateTo'; path: string };

export interface BloodbankSlugAccessInput {
  bloodbankSlug: string | undefined;
  fullPath: string;
  retried: boolean;
  isBypassRoute: boolean;
  allBloodBankSlugs: string[];
  firstBloodBankSlug: string | null;
}

export function decideBloodbankSlugAccess(
  input: BloodbankSlugAccessInput
): BloodbankSlugAccessDecision {
  const { bloodbankSlug, fullPath, retried, isBypassRoute, allBloodBankSlugs } =
    input;

  if (!bloodbankSlug || isBypassRoute) {
    return { kind: 'pass' };
  }
  if (allBloodBankSlugs.includes(bloodbankSlug)) {
    return { kind: 'pass' };
  }
  if (!retried) {
    const separator = fullPath.includes('?') ? '&' : '?';
    return {
      kind: 'redirectToId',
      redirectPath: `${fullPath}${separator}retried=1`,
    };
  }
  return { kind: 'pass' }; // placeholder — fixed in Task 3
}
