import { describe, expect, it } from 'vitest';
import { usesBusiness } from './AppProviders';

describe('usesBusiness', () => {
  it('opens the list of Businesses on the tools, Your business and the business setup', () => {
    for (const path of ['/tools/invoice/', '/business/', '/business', '/setup/', '/setup']) expect(usesBusiness(path)).toBe(true);
  });

  it('leaves it closed on pages that read and create nothing', () => {
    for (const path of ['/', '/privacy/', '/setups/', null]) expect(usesBusiness(path)).toBe(false);
  });
});
