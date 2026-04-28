import { describe, it, expect } from 'vitest';
import { decideBloodbankSlugAccess } from '~/utils/decideBloodbankSlugAccess';

const baseInput = {
  bloodbankSlug: 'banco-a' as string | undefined,
  fullPath: '/banco-a',
  retried: false,
  isBypassRoute: false,
  allBloodBankSlugs: ['banco-a'],
  firstBloodBankSlug: 'banco-a' as string | null,
};

describe('decideBloodbankSlugAccess', () => {
  describe('pass', () => {
    it('passes when there is no bloodbank slug in the route', () => {
      const result = decideBloodbankSlugAccess({
        ...baseInput,
        bloodbankSlug: undefined,
        fullPath: '/agendar',
      });
      expect(result).toEqual({ kind: 'pass' });
    });

    it('passes when the route is a bypass route', () => {
      const result = decideBloodbankSlugAccess({
        ...baseInput,
        isBypassRoute: true,
      });
      expect(result).toEqual({ kind: 'pass' });
    });

    it('passes when the slug is in allBloodBankSlugs', () => {
      const result = decideBloodbankSlugAccess({
        ...baseInput,
        bloodbankSlug: 'banco-a',
        allBloodBankSlugs: ['banco-a', 'banco-b'],
      });
      expect(result).toEqual({ kind: 'pass' });
    });
  });

  describe('redirectToId', () => {
    it('redirects to ID with ?retried=1 when slug is not in roles and not retried, no existing query', () => {
      const result = decideBloodbankSlugAccess({
        ...baseInput,
        bloodbankSlug: 'banco-x',
        fullPath: '/banco-x/coletas',
        retried: false,
        allBloodBankSlugs: ['banco-a'],
      });
      expect(result).toEqual({
        kind: 'redirectToId',
        redirectPath: '/banco-x/coletas?retried=1',
      });
    });

    it('redirects to ID with &retried=1 when fullPath already has a query string', () => {
      const result = decideBloodbankSlugAccess({
        ...baseInput,
        bloodbankSlug: 'banco-x',
        fullPath: '/banco-x/coletas?foo=bar',
        retried: false,
        allBloodBankSlugs: ['banco-a'],
      });
      expect(result).toEqual({
        kind: 'redirectToId',
        redirectPath: '/banco-x/coletas?foo=bar&retried=1',
      });
    });
  });
});
