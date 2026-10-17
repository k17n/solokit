import { createStaticEntitlements, freeEntitlements, type Entitlements } from './entitlements';
import { noMessaging, noPayments, noSharing, noSigning, noSync, type DocumentSharing, type Messaging, type Payments, type Signing, type SyncAdapter } from './extensions';
import type { FeatureId } from './features';
import type { SlotRegistry } from './slots';

/** Bump the major number when the contract changes in a way an existing plugin would break on. */
export const PLATFORM_API_VERSION = 1;

/** Everything the app can call. Every member always exists, so callers never null-check. */
export interface Platform<TComponent = unknown> {
  entitlements: Entitlements;
  sync: SyncAdapter;
  sharing: DocumentSharing;
  messaging: Messaging;
  payments: Payments;
  signing: Signing;
  slots: SlotRegistry<TComponent>;
  /** True when a plugin was merged in. */
  hasPlugin: boolean;
}

/** What the private repo exports: any subset of the platform, plus the contract version it was built against. */
export interface PlatformPlugin<TComponent = unknown> {
  /** The {@link PLATFORM_API_VERSION} the plugin was built for. */
  apiVersion: number;
  entitlements?: Entitlements;
  /** Shortcut for `entitlements`: a fixed list of granted paid features. Ignored when `entitlements` is set. */
  grant?: readonly FeatureId[];
  sync?: SyncAdapter;
  sharing?: DocumentSharing;
  messaging?: Messaging;
  payments?: Payments;
  signing?: Signing;
  slots?: SlotRegistry<TComponent>;
}

export class PlatformVersionError extends Error {
  constructor(found: unknown) {
    super(`Plugin was built for platform API ${String(found)}, this app provides ${PLATFORM_API_VERSION}`);
    this.name = 'PlatformVersionError';
  }
}

/** The free platform, with a plugin's pieces laid over it. Without a plugin this is the free platform. */
export function createPlatform<TComponent = unknown>(plugin?: PlatformPlugin<TComponent>): Platform<TComponent> {
  if (!plugin) {
    return { entitlements: freeEntitlements, sync: noSync, sharing: noSharing, messaging: noMessaging, payments: noPayments, signing: noSigning, slots: {}, hasPlugin: false };
  }
  if (plugin.apiVersion !== PLATFORM_API_VERSION) throw new PlatformVersionError(plugin.apiVersion);
  return {
    entitlements: plugin.entitlements ?? (plugin.grant ? createStaticEntitlements(plugin.grant) : freeEntitlements),
    sync: plugin.sync ?? noSync,
    sharing: plugin.sharing ?? noSharing,
    messaging: plugin.messaging ?? noMessaging,
    payments: plugin.payments ?? noPayments,
    signing: plugin.signing ?? noSigning,
    slots: { ...plugin.slots },
    hasPlugin: true,
  };
}

let registered: PlatformPlugin | undefined;
let composed: Platform | undefined;

/**
 * Called once by the hosting app at startup, before the first {@link getPlatform}. The private repo supplies the plugin
 * (see docs/extension-points.md). Calling it twice, or after the platform was read, throws: a half-swapped platform is worse than none.
 */
export function registerPlatform<TComponent = unknown>(plugin: PlatformPlugin<TComponent>): void {
  if (registered || composed) throw new Error('registerPlatform must be called once, before the platform is read');
  registered = plugin as PlatformPlugin;
}

/** The composed platform, built on first use and then fixed. */
export function getPlatform<TComponent = unknown>(): Platform<TComponent> {
  composed ??= createPlatform(registered);
  return composed as Platform<TComponent>;
}

/** For tests only. */
export function resetPlatformForTests(): void {
  registered = undefined;
  composed = undefined;
}
