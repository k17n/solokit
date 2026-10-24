import { describe, expect, it } from 'vitest';
import { usesBusiness } from './AppProviders';

describe('usesBusiness', () => {
  it('opens the list of Businesses everywhere in the app', () => {
    for (const path of ['/app', '/app/', '/app/invoice/', '/app/business/', '/app/setup/']) expect(usesBusiness(path)).toBe(true);
  });

  it('leaves it closed on the site, which reads and creates nothing', () => {
    for (const path of ['/', '/privacy/', '/tools/invoice/', '/business/', '/setup/', '/apps/', null]) expect(usesBusiness(path)).toBe(false);
  });
});
