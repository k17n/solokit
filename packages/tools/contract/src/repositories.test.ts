import { createMemoryStore } from '@solokit/storage';
import { describe, expect, it } from 'vitest';
import { createContractDraft, partyFromProfile } from './draft';
import { ContractInvalidError, ContractLockedError, createContractStorage } from './repositories';
import { makeContract } from './testing';

const T0 = new Date('2026-10-16T10:00:00.000Z');
let clock = T0.getTime();
const tick = () => new Date((clock += 60_000));
const setup = () => {
  const store = createMemoryStore();
  return { store, storage: createContractStorage(store, { now: tick }) };
};

describe('contract storage', () => {
  it('saves and reads back a contract, counting versions', async () => {
    const { storage } = setup();
    const first = await storage.save(makeContract('services'));
    expect(first.version).toBe(1);
    expect(first.updatedAt >= first.createdAt).toBe(true);
    const second = await storage.save({ ...first, title: 'Renamed' });
    expect(second.version).toBe(2);
    expect(second.createdAt).toBe(first.createdAt);
    expect((await storage.get(first.id))?.title).toBe('Renamed');
  });

  it('lists the newest change first', async () => {
    const { storage } = setup();
    await storage.save(makeContract('nda-mutual', { id: 'a', title: 'A' }));
    await storage.save(makeContract('nda-one-way', { id: 'b', title: 'B' }));
    await storage.save({ ...(await storage.get('a'))!, title: 'A again' });
    expect((await storage.list()).map((contract) => contract.id)).toEqual(['a', 'b']);
  });

  it('can save a blank draft: drafts need not be valid', async () => {
    const { storage } = setup();
    const saved = await storage.save(createContractDraft({ id: 'blank', kind: 'services', now: T0 }));
    expect(saved.status).toBe('draft');
  });

  it('removes a contract', async () => {
    const { storage } = setup();
    await storage.save(makeContract('services'));
    await storage.remove('contract-services');
    expect(await storage.list()).toEqual([]);
  });

  it('refuses to save a contract as final without checking it', async () => {
    const { storage } = setup();
    await expect(storage.save(makeContract('services', { status: 'final' }))).rejects.toBeInstanceOf(ContractLockedError);
  });

  it('finalises a complete contract: locks it and freezes the wording', async () => {
    const { storage } = setup();
    await storage.save(makeContract('services'));
    const final = await storage.finalise('contract-services');
    expect(final.status).toBe('final');
    expect(final.finalDocument?.heading).toBe('Freelance Services Agreement');
    expect(final.finalDocument?.clauses.length).toBeGreaterThan(10);
    await expect(storage.save({ ...final, title: 'Edited' })).rejects.toBeInstanceOf(ContractLockedError);
    expect((await storage.get(final.id))?.title).toBe('Sample services');
  });

  it('refuses to finalise an incomplete contract and lists what is missing', async () => {
    const { storage } = setup();
    await storage.save(createContractDraft({ id: 'blank', kind: 'nda-mutual', now: T0 }));
    const error = await storage.finalise('blank').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ContractInvalidError);
    expect((error as ContractInvalidError).issues.map((issue) => issue.path)).toContain('variables.purpose');
    expect((await storage.get('blank'))?.status).toBe('draft');
  });

  it('reopens a final contract for editing and drops the frozen wording', async () => {
    const { storage } = setup();
    await storage.save(makeContract('nda-mutual'));
    await storage.finalise('contract-nda-mutual');
    const reopened = await storage.reopen('contract-nda-mutual');
    expect(reopened.status).toBe('draft');
    expect(reopened.finalDocument).toBeUndefined();
    const edited = await storage.save({ ...reopened, title: 'Edited' });
    expect(edited.title).toBe('Edited');
  });

  it('duplicates a contract as a new draft, from a draft or a final one', async () => {
    const { storage } = setup();
    await storage.save(makeContract('services'));
    await storage.finalise('contract-services');
    const copy = await storage.duplicate('contract-services', { id: 'copy' });
    expect(copy).toMatchObject({ id: 'copy', title: 'Sample services (copy)', status: 'draft', version: 1 });
    expect(copy.finalDocument).toBeUndefined();
    expect(copy.parties[0]?.name).toBe('Asha Rao Consulting');
    expect((await storage.get('contract-services'))?.status).toBe('final');
    await expect(storage.duplicate('missing', { id: 'x' })).rejects.toThrow('Agreement not found');
  });

  it('keeps contracts in their own collection', async () => {
    const { store, storage } = setup();
    await storage.save(makeContract('services'));
    expect(await store.list('contracts')).toHaveLength(1);
    expect(await store.list('invoices')).toHaveLength(0);
  });
});

describe('partyFromProfile', () => {
  it('copies name, address and tax ids from a profile and leaves the signatory to fill in', () => {
    const party = partyFromProfile('freelancer', {
      name: 'Asha Rao Consulting',
      address: { line1: '12 Linking Road', city: 'Mumbai', postalCode: '400050', country: 'India' },
      email: 'asha@example.com',
      pan: 'AAPFU0939F',
    });
    expect(party).toMatchObject({ role: 'freelancer', name: 'Asha Rao Consulting', email: 'asha@example.com', pan: 'AAPFU0939F', signatoryName: '', signatoryTitle: '' });
    expect(party.address).toEqual({ line1: '12 Linking Road', city: 'Mumbai', postalCode: '400050', country: 'India' });
  });
});
