import { describe, expect, it } from 'vitest';
import { normaliseClient } from './normalise';
import { makeClient } from './testing';

describe('normaliseClient', () => {
  it('trims, upper-cases and lower-cases', () => {
    const result = normaliseClient(makeClient({ name: ' Northwind ', gstin: ' 27aabct3518q1zw ', pan: 'aabct3518q', email: ' A@B.COM ', phone: ' ' }));
    expect(result).toMatchObject({ name: 'Northwind', gstin: '27AABCT3518Q1ZW', pan: 'AABCT3518Q', email: 'a@b.com' });
    expect('phone' in result).toBe(false);
  });

  it('does not mutate its input', () => {
    const client = makeClient({ name: ' X ' });
    normaliseClient(client);
    expect(client.name).toBe(' X ');
  });
});
