import { createMemoryStore } from '@solokit/storage';
import { describe, expect, it } from 'vitest';
import { migrateProfile } from './migrate';
import { PROFILE_SCHEMA_VERSION } from './model';
import { normaliseProfile } from './normalise';
import { createProfileRepository } from './repository';
import { missingFields } from './requirements';
import { makeProfile } from './testing';
import { validateProfile } from './validation';

describe('migrateProfile', () => {
  it('upgrades a record saved before schema versions existed, keeping every field', () => {
    const old = makeProfile({ website: 'https://asha.example', phone: '98765 43210', logoDataUrl: 'data:image/png;base64,AAAA' });
    const migrated = migrateProfile(old)!;
    expect(migrated).toEqual({ ...old, schemaVersion: PROFILE_SCHEMA_VERSION });
    expect('brand' in migrated).toBe(false);
  });

  it('is idempotent', () => {
    const once = migrateProfile(makeProfile({ brand: { primary: '#0b1b3a' }, brandSource: 'logo' }))!;
    expect(migrateProfile(once)).toEqual(once);
  });

  it('keeps valid brand colours (upper-cased) and drops invalid ones and a source with nothing to describe', () => {
    const migrated = migrateProfile({ ...makeProfile(), brand: { primary: '#0b1b3a', secondary: 'red', text: 12 }, brandSource: 'logo' })!;
    expect(migrated.brand).toEqual({ primary: '#0B1B3A' });
    expect(migrated.brandSource).toBe('logo');
    const none = migrateProfile({ ...makeProfile(), brand: { primary: 'nope' }, brandSource: 'logo' })!;
    expect('brand' in none).toBe(false);
    expect('brandSource' in none).toBe(false);
    expect('brandSource' in migrateProfile({ ...makeProfile(), brand: { primary: '#000000' }, brandSource: 'magic' })!).toBe(false);
  });

  it('gives a record without an address an empty one', () => {
    const { address: _address, ...bare } = makeProfile();
    expect(migrateProfile(bare)!.address).toEqual({ line1: '', city: '', country: 'India' });
  });

  it('leaves a record from a newer SoloKit alone', () => {
    const newer = { ...makeProfile(), schemaVersion: 99, futureField: true };
    expect(migrateProfile(newer)).toBe(newer);
  });

  it('returns undefined for something that is not a profile', () => {
    expect(migrateProfile(undefined)).toBeUndefined();
    expect(migrateProfile('x')).toBeUndefined();
    expect(migrateProfile({ id: 'me' })).toBeUndefined();
  });
});

describe('migrateProfile: brand theme link and GST placeholder', () => {
  it('keeps a well-formed link and the placeholder flag, and drops malformed ones', () => {
    const kept = migrateProfile({ ...makeProfile(), brandTheme: { themeId: 't1', signature: 'abc' }, gstUnconfirmed: true })!;
    expect(kept.brandTheme).toEqual({ themeId: 't1', signature: 'abc' });
    expect(kept.gstUnconfirmed).toBe(true);
    const dropped = migrateProfile({ ...makeProfile(), brandTheme: { themeId: 1 }, gstUnconfirmed: 'yes' })!;
    expect('brandTheme' in dropped).toBe(false);
    expect('gstUnconfirmed' in dropped).toBe(false);
  });
});

describe('profile repository', () => {
  it('saves under the fixed id with the schema version, and reads it back', async () => {
    const store = createMemoryStore();
    const repo = createProfileRepository(store);
    expect(await repo.get()).toBeUndefined();
    await repo.save(makeProfile({ name: 'Asha' }));
    expect(await repo.get()).toMatchObject({ id: 'me', name: 'Asha', schemaVersion: PROFILE_SCHEMA_VERSION });
    expect(await store.get('profile', 'me')).toMatchObject({ schemaVersion: PROFILE_SCHEMA_VERSION });
  });

  it('upgrades an old stored record on read without rewriting it', async () => {
    const store = createMemoryStore();
    await store.put('profile', makeProfile({ name: 'Old' }));
    expect((await createProfileRepository(store).get())?.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect('schemaVersion' in ((await store.get('profile', 'me')) as object)).toBe(false);
  });

  it('never lowers the version of a record from a newer SoloKit', async () => {
    const store = createMemoryStore();
    const repo = createProfileRepository(store);
    await repo.save({ ...makeProfile(), schemaVersion: 7 });
    expect((await store.get<{ id: string; schemaVersion: number }>('profile', 'me'))?.schemaVersion).toBe(7);
  });
});

describe('brand colours on the profile', () => {
  it('are normalised and validated', () => {
    const normalised = normaliseProfile(makeProfile({ brand: { primary: ' #0b1b3a ', secondary: '' }, brandSource: 'manual' }));
    expect(normalised.brand).toEqual({ primary: '#0B1B3A' });
    expect(validateProfile(normalised)).toEqual([]);
    expect(validateProfile(makeProfile({ brand: { primary: 'blue', text: '#12' } })).map((issue) => issue.path)).toEqual(['brand.primary', 'brand.text']);
  });

  it('an empty brand disappears together with its source', () => {
    const normalised = normaliseProfile(makeProfile({ brand: { primary: ' ' }, brandSource: 'logo' }));
    expect('brand' in normalised).toBe(false);
    expect('brandSource' in normalised).toBe(false);
  });

  it('lower-cases the website like the email', () => {
    expect(normaliseProfile(makeProfile({ website: ' HTTPS://Asha.Example ' })).website).toBe('https://asha.example');
  });
});

describe('missingFields', () => {
  const paths = (list: { path: string }[]) => list.map((item) => item.path);

  it('asks a brand new person for the unconditional invoice basics only', () => {
    expect(paths(missingFields(undefined, 'invoice'))).toEqual(['name', 'gstStatus', 'address.line1', 'address.city']);
  });

  it('asks for GSTIN and state only when GST registered', () => {
    const base = makeProfile({ gstStatus: 'regular', gstin: undefined, address: { line1: 'x', city: 'y', country: 'India' } });
    expect(paths(missingFields(base, 'invoice'))).toEqual(['address.stateCode', 'gstin']);
    expect(missingFields({ ...base, gstStatus: 'unregistered' }, 'invoice')).toEqual([]);
  });

  it('a complete profile has nothing missing for either tool', () => {
    expect(missingFields(makeProfile(), 'invoice', { includeRecommended: true })).toEqual([]);
    expect(missingFields(makeProfile(), 'contract')).toEqual([]);
  });

  it('a contract needs an email but not a GSTIN', () => {
    const profile = makeProfile({ email: undefined, gstin: undefined, gstStatus: 'unregistered' });
    expect(paths(missingFields(profile, 'contract'))).toEqual(['email']);
  });

  it('asks for the GST status again when it was only a placeholder, and not for GSTIN until it is chosen', () => {
    const profile = makeProfile({ gstStatus: 'unregistered', gstUnconfirmed: true, gstin: undefined });
    expect(paths(missingFields(profile, 'invoice'))).toEqual(['gstStatus']);
    expect(missingFields(profile, 'contract')).toEqual([]);
    expect(paths(missingFields({ ...profile, gstUnconfirmed: undefined }, 'invoice'))).toEqual([]);
  });

  it('lists recommended fields only when asked, and treats whitespace as empty', () => {
    const profile = makeProfile({ phone: '  ' });
    expect(missingFields(profile, 'contract')).toEqual([]);
    expect(paths(missingFields(profile, 'contract', { includeRecommended: true }))).toEqual(['phone']);
  });
});
