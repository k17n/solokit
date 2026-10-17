# Extension points (open core)

SoloKit is built to grow into an open-core product: this public repo stays the free, local-first app, and a separate private repo adds paid features that need a server. This file is the contract between the two. Nothing in this repo imports from the private repo, ever. The public side defines the interfaces and free defaults; the private side supplies a plugin.

Today there is no private repo, no payment, no account and no network code. The contract exists so the free app already works with, and without, a plugin.

## The package

`@solokit/platform` (`packages/platform`) is plain TypeScript with no UI library. It defines:

| Piece | What it is | Free default |
|---|---|---|
| `FEATURES`, `FeatureId` | Every plan feature as data: id, label, description, `tier`, `needsServer` | Ten paid features, two free |
| `Entitlements` | `has(feature)` and `subscribe(listener)` | `freeEntitlements`: free features true, paid false |
| `SyncAdapter` | `push` / `pull` of Business snapshots, `status`, `lastSyncedAt`, `conflictPolicy`. Encryption is the adapter's job | `noSync` (`available: false`) |
| `DocumentSharing` | Publish a rendered PDF to a hosted link, revoke it | `noSharing` |
| `Messaging` | Send an email or a payment reminder | `noMessaging` |
| `Payments` | Create a payment link | `noPayments` |
| `Signing` | Request an e-signature | `noSigning` |
| Slots (`SlotContexts`, `SLOTS`) | Named places where a plugin may render a component | Nothing renders |
| `createPlatform(plugin?)` | Lays a plugin's pieces over the free defaults | Free platform when no plugin |
| `registerPlatform(plugin)` / `getPlatform()` | One-time registration at startup for plugins loaded at runtime | |
| `PLATFORM_API_VERSION` | The contract version a plugin declares in `apiVersion` | |

Every adapter call returns an `ExtensionResult` (`{ ok: true, value }` or `{ ok: false, reason }`), so "not available" is a value, not an exception. The public app never implements an adapter; it only defines the types.

`@solokit/platform/testing` exports `createFakeEntitlements()` (grant and revoke in a test).

### Features

`cloud-sync`, `brand-kit-sync`, `hosted-invoice-links`, `email-sending`, `payment-reminders`, `payment-links`, `e-sign`, `e-invoice-irn`, `team-members`, `custom-domain` (all paid, all need a server), plus `local-tools` and `local-backup` (free). A feature that does not need a server cannot be a real paywall, because browser code can be changed by the user.

### Slots

| Slot | Where | Context |
|---|---|---|
| `invoice.viewer.actions` | Action row of an issued invoice, quotation or proforma | `{ documentId, kind }` |
| `contract.viewer.actions` | Action row of an agreement | `{ documentId, kind, final }` |
| `business.plans` | The Plans section of the Business page (only rendered when upsell is on) | none |

A tool renders `<ProSlot name="..." context={...} />`. Behaviour:

1. A plugin registered a component for the slot: it renders. The plugin decides what an unentitled user sees (usually it checks `useEntitlement` and shows its own upgrade prompt or nothing).
2. Otherwise, if `SHOW_UPSELL` (`apps/web/src/site.ts`) is true and the user lacks the slot's paid features, a plain placeholder says "Available in a paid plan (coming soon)" and names the features. It links nowhere and collects nothing.
3. Otherwise nothing renders. `SHOW_UPSELL` is `false`, so by default the app looks exactly as it did before.

Turn `SHOW_UPSELL` on only when there is something honest to say. Do not use it to imply a feature exists that does not.

## The web side

`apps/web/src/platform`:

- `AppPlatform` composes the platform once at the app root (in `AppProviders`) and provides it.
- `useEntitlement(feature)` returns a boolean and re-renders when entitlements change. Outside a provider it answers from the free platform.
- `usePlatform()` gives the adapters. Check `available` before showing a control for one.
- `ProSlot` and `UpsellPlaceholder`.
- `plugin.ts` is the single place the app looks for a bundled plugin. Here it exports `undefined`.

## How the private repo plugs in

The private repo depends on `@solokit/platform` for the types and exports a `PlatformPlugin`:

    export const plugin: PlatformPlugin = {
      apiVersion: PLATFORM_API_VERSION,
      entitlements,            // fed by the server after sign-in
      sync, sharing, messaging, payments, signing,   // adapters, each optional
      slots: { 'invoice.viewer.actions': ShareButton },
    };

Two ways to deliver it, both leaving this repo untouched:

1. **Build-time alias.** The private repo builds the app with a bundler alias that replaces `apps/web/src/platform/plugin.ts` with its own module exporting `plugin`. Use this for a separate paid build or hosting.
2. **Runtime import.** The public build stays as is. After sign-in, the host page dynamically imports the plugin bundle from an authenticated URL and calls `registerPlatform(plugin)` once, before `AppPlatform` first renders. Calling it twice, or after the platform was read, throws.

Either way the app works unchanged with no plugin. A plugin built for a different `PLATFORM_API_VERSION` is refused with `PlatformVersionError` and the app should fall back to the free platform.

### Loading paid UI only for entitled users

Paid components should not ship in the public bundle. The server returns the plugin bundle only to a signed-in user whose plan includes it (as HextaUI serves Pro blocks from a token-protected registry). Entitlements arrive with it. A free user never downloads paid UI.

### Security note

Browser code is not a secret. Anyone can edit `useEntitlement` in their own browser and make a locked button appear. That is fine: the button must not be the gate. Every paid action (sync, hosted link, email, payment link, signing) must be authorised by the server against the user's plan, and the server must never trust a client's claim about entitlements. Treat `Entitlements.has` as a way to decide what to draw, nothing more. Paid server code lives in the private repo for the same reason: in a public repo the paywall would only be a promise.

Privacy: the privacy page currently says nothing leaves the device. Any adapter that sends data off the device needs the page updated, and sync must be end-to-end encrypted by the adapter.

## Versioning

- `@solokit/platform` follows semver. Its `version` in `package.json` and `PLATFORM_API_VERSION` move together by major number.
- Minor: new features, new slots, new optional members. Patch: fixes and docs.
- Major: removing or renaming a feature, slot, or adapter member, changing a result shape. `PLATFORM_API_VERSION` is bumped and plugins must be rebuilt.
- The private repo pins a compatible range and declares the `apiVersion` it was built for.
- A free-tier feature never moves to paid in a minor release.

## Out of scope for this repo

Paid features, payments, accounts, servers and anything that sends user data off the device are not built here and are not accepted as contributions. This repo only defines the contract and the free behaviour.
