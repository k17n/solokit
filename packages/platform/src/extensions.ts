import type { Snapshot } from '@solokit/storage';
import type { ExtensionResult } from './result';
import { UNAVAILABLE } from './result';

/** How a sync adapter settles a Business that changed on two devices. A policy name, not an algorithm: the adapter implements it. */
export type ConflictPolicy = 'last-write-wins' | 'ask-user' | 'keep-both';

export type SyncStatus = 'unavailable' | 'idle' | 'syncing' | 'offline' | 'error';

/**
 * Cloud sync of Business snapshots (feature `cloud-sync`). The adapter owns everything about the wire: authentication,
 * transport, conflict handling and encryption. Snapshots handed to `push` are plain; the adapter must encrypt them
 * before they leave the device, and the server must never be able to read them. The public app never implements this.
 */
export interface SyncAdapter {
  /** False for the free default. When false, the interface hides sync controls. */
  readonly available: boolean;
  readonly conflictPolicy: ConflictPolicy;
  status(): SyncStatus;
  /** ISO time of the last successful sync of this Business, if any. */
  lastSyncedAt(workspaceId: string): string | undefined;
  subscribe(listener: () => void): () => void;
  push(workspaceId: string, snapshot: Snapshot): Promise<ExtensionResult<{ syncedAt: string }>>;
  /** The newest remote snapshot, or `undefined` when nothing is stored remotely yet. */
  pull(workspaceId: string): Promise<ExtensionResult<Snapshot | undefined>>;
}

export const noSync: SyncAdapter = {
  available: false,
  conflictPolicy: 'ask-user',
  status: () => 'unavailable',
  lastSyncedAt: () => undefined,
  subscribe: () => () => {},
  push: async () => UNAVAILABLE,
  pull: async () => UNAVAILABLE,
};

/** Publishes a rendered document to a hosted link (features `hosted-invoice-links`, `custom-domain`). */
export interface DocumentSharing {
  readonly available: boolean;
  /** `pdf` is the already rendered file. The result is the public URL. */
  publish(input: { documentId: string; fileName: string; pdf: Uint8Array }): Promise<ExtensionResult<{ url: string; expiresAt?: string }>>;
  revoke(url: string): Promise<ExtensionResult>;
}

export const noSharing: DocumentSharing = { available: false, publish: async () => UNAVAILABLE, revoke: async () => UNAVAILABLE };

/** Sends email and payment reminders (features `email-sending`, `payment-reminders`). */
export interface Messaging {
  readonly available: boolean;
  sendEmail(input: { to: string; subject: string; body: string; attachment?: { fileName: string; pdf: Uint8Array } }): Promise<ExtensionResult>;
  /** Schedules or sends a reminder for an unpaid invoice. */
  sendReminder(input: { invoiceId: string; to: string; body: string }): Promise<ExtensionResult>;
}

export const noMessaging: Messaging = { available: false, sendEmail: async () => UNAVAILABLE, sendReminder: async () => UNAVAILABLE };

/** Creates online payment links for invoices (feature `payment-links`). */
export interface Payments {
  readonly available: boolean;
  /** Amount is in the smallest unit (paise), as everywhere in SoloKit. */
  createPaymentLink(input: { invoiceId: string; amountMinor: number; currency: string; description: string }): Promise<ExtensionResult<{ url: string }>>;
}

export const noPayments: Payments = { available: false, createPaymentLink: async () => UNAVAILABLE };

/** Asks the other party to sign a document online (feature `e-sign`). */
export interface Signing {
  readonly available: boolean;
  requestSignature(input: { documentId: string; signers: { name: string; email: string }[] }): Promise<ExtensionResult<{ requestId: string }>>;
}

export const noSigning: Signing = { available: false, requestSignature: async () => UNAVAILABLE };
