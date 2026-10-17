import { afterEach, describe, expect, it } from 'vitest';
import { FEATURES, PLATFORM_API_VERSION, PlatformVersionError, createPlatform, freeEntitlements, getPlatform, paidFeatures, registerPlatform, resetPlatformForTests, type FeatureId, type SyncAdapter } from './index';
import { createFakeEntitlements } from './testing';

afterEach(() => resetPlatformForTests());

describe('features', () => {
  it('declares the ten paid features and marks them server features', () => {
    expect(paidFeatures().map((f) => f.id).sort()).toEqual(
      ['brand-kit-sync', 'cloud-sync', 'custom-domain', 'e-invoice-irn', 'e-sign', 'email-sending', 'hosted-invoice-links', 'payment-links', 'payment-reminders', 'team-members'],
    );
    expect(paidFeatures().every((f) => f.needsServer)).toBe(true);
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
  });
});

describe('free platform', () => {
  it('denies paid features, allows free ones, and every extension is unavailable', async () => {
    const platform = createPlatform();
    for (const feature of paidFeatures()) expect(platform.entitlements.has(feature.id as FeatureId)).toBe(false);
    expect(freeEntitlements.has('local-tools')).toBe(true);
    expect(freeEntitlements.has('nonsense' as FeatureId)).toBe(false);
    expect(platform.hasPlugin).toBe(false);
    expect(platform.sync.available).toBe(false);
    expect(platform.sync.status()).toBe('unavailable');
    expect(await platform.sharing.publish({ documentId: 'a', fileName: 'a.pdf', pdf: new Uint8Array() })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await platform.messaging.sendEmail({ to: 'a@b.c', subject: '', body: '' })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await platform.payments.createPaymentLink({ invoiceId: 'a', amountMinor: 1, currency: 'INR', description: '' })).toEqual({ ok: false, reason: 'unavailable' });
    expect(await platform.signing.requestSignature({ documentId: 'a', signers: [] })).toEqual({ ok: false, reason: 'unavailable' });
    expect(platform.slots).toEqual({});
  });
});

describe('createPlatform with a plugin', () => {
  it('grants features by list or by an entitlements object', () => {
    expect(createPlatform({ apiVersion: PLATFORM_API_VERSION, grant: ['cloud-sync'] }).entitlements.has('cloud-sync')).toBe(true);
    expect(createPlatform({ apiVersion: PLATFORM_API_VERSION, grant: ['cloud-sync'] }).entitlements.has('e-sign')).toBe(false);
    const fake = createFakeEntitlements();
    const platform = createPlatform({ apiVersion: PLATFORM_API_VERSION, entitlements: fake });
    let calls = 0;
    platform.entitlements.subscribe(() => calls++);
    fake.grant('e-sign');
    expect(platform.entitlements.has('e-sign')).toBe(true);
    expect(calls).toBe(1);
  });

  it('replaces only the adapters it supplies', () => {
    const sync: SyncAdapter = {
      available: true,
      conflictPolicy: 'last-write-wins',
      status: () => 'idle',
      lastSyncedAt: () => '2026-01-01T00:00:00Z',
      subscribe: () => () => {},
      push: async () => ({ ok: true, value: { syncedAt: 'now' } }),
      pull: async () => ({ ok: true, value: undefined }),
    };
    const platform = createPlatform({ apiVersion: PLATFORM_API_VERSION, sync });
    expect(platform.sync).toBe(sync);
    expect(platform.sharing.available).toBe(false);
    expect(platform.hasPlugin).toBe(true);
  });

  it('refuses a plugin built for another contract version', () => {
    expect(() => createPlatform({ apiVersion: 999 })).toThrow(PlatformVersionError);
  });
});

describe('registerPlatform', () => {
  it('is used by getPlatform, once', () => {
    registerPlatform({ apiVersion: PLATFORM_API_VERSION, grant: ['team-members'] });
    expect(getPlatform().entitlements.has('team-members')).toBe(true);
    expect(() => registerPlatform({ apiVersion: PLATFORM_API_VERSION })).toThrow();
  });

  it('gives the free platform when nothing was registered, and cannot be registered afterwards', () => {
    expect(getPlatform().hasPlugin).toBe(false);
    expect(() => registerPlatform({ apiVersion: PLATFORM_API_VERSION })).toThrow(/before the platform is read/);
  });
});
