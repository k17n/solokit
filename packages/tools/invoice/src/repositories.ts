import { formatInvoiceNumber, indianFiscalYear, nextSequence } from '@solokit/core';
import type { DataStore } from '@solokit/storage';
import { SELLER_ID, SETTINGS_ID, type Client, type InvoiceRecord, type InvoiceSettings, type SellerProfile } from './model';
import { DEFAULT_THEME_ID, type InvoiceTheme } from './themes';

export class InvoiceNumberTakenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceNumberTakenError';
  }
}

export class InvoiceLockedError extends Error {
  constructor(message = 'This invoice has been issued and cannot be changed this way') {
    super(message);
    this.name = 'InvoiceLockedError';
  }
}

export class IssuedInvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IssuedInvoiceError';
  }
}

export interface InvoiceStorageOptions {
  now?: () => Date;
}

export interface InvoiceStorage {
  profile: {
    get(): Promise<SellerProfile | undefined>;
    save(profile: SellerProfile): Promise<void>;
  };
  clients: {
    list(): Promise<Client[]>;
    get(id: string): Promise<Client | undefined>;
    save(client: Client): Promise<void>;
    remove(id: string): Promise<void>;
  };
  invoices: {
    list(): Promise<InvoiceRecord[]>;
    get(id: string): Promise<InvoiceRecord | undefined>;
    save(invoice: InvoiceRecord): Promise<InvoiceRecord>;
    remove(id: string): Promise<void>;
    cancel(id: string): Promise<InvoiceRecord>;
    nextNumber(issueDate: string): Promise<string>;
  };
  themes: {
    list(): Promise<InvoiceTheme[]>;
    save(theme: InvoiceTheme): Promise<void>;
    remove(id: string): Promise<void>;
  };
  settings: {
    get(): Promise<InvoiceSettings>;
    update(patch: Partial<Omit<InvoiceSettings, 'id'>>): Promise<InvoiceSettings>;
  };
}

const DEFAULT_SETTINGS: InvoiceSettings = { id: SETTINGS_ID, defaultThemeId: DEFAULT_THEME_ID, onboarded: false };

export function createInvoiceStorage(store: DataStore, options: InvoiceStorageOptions = {}): InvoiceStorage {
  const now = options.now ?? (() => new Date());

  async function listInvoices(): Promise<InvoiceRecord[]> {
    const all = await store.list<InvoiceRecord>('invoices');
    return all.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number, undefined, { numeric: true }));
  }

  async function saveInvoice(invoice: InvoiceRecord): Promise<InvoiceRecord> {
    const all = await store.list<InvoiceRecord>('invoices');
    const existing = all.find((other) => other.id === invoice.id);
    if (existing && existing.status !== 'draft') {
      if (
        invoice.number !== existing.number ||
        invoice.status === 'draft' ||
        (existing.status === 'cancelled' && invoice.status !== 'cancelled')
      ) {
        throw new InvoiceLockedError();
      }
    }
    const key = (number: string) => number.trim().toUpperCase();
    if (all.some((other) => other.id !== invoice.id && key(other.number) === key(invoice.number))) {
      throw new InvoiceNumberTakenError(`Invoice number ${invoice.number} is already used by another invoice`);
    }
    const stamp = now().toISOString();
    const saved: InvoiceRecord = { ...invoice, createdAt: invoice.createdAt || stamp, updatedAt: stamp };
    await store.put('invoices', saved);
    return saved;
  }

  return {
    profile: {
      get: () => store.get<SellerProfile>('profile', SELLER_ID),
      save: (profile) => store.put('profile', { ...profile, id: SELLER_ID }),
    },

    clients: {
      list: async () => {
        const all = await store.list<Client>('clients');
        return all.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      },
      get: (id) => store.get<Client>('clients', id),
      save: (client) => store.put('clients', client),
      remove: (id) => store.remove('clients', id),
    },

    invoices: {
      list: listInvoices,
      get: (id) => store.get<InvoiceRecord>('invoices', id),
      save: saveInvoice,
      async remove(id) {
        const existing = await store.get<InvoiceRecord>('invoices', id);
        if (existing && existing.status !== 'draft') {
          throw new IssuedInvoiceError(
            'Issued invoices cannot be deleted. Cancel the invoice instead so its number stays used.',
          );
        }
        await store.remove('invoices', id);
      },
      async cancel(id) {
        const existing = await store.get<InvoiceRecord>('invoices', id);
        if (!existing) throw new Error('Invoice not found');
        if (existing.status === 'draft') throw new Error('Only issued invoices can be cancelled; delete a draft instead');
        return saveInvoice({ ...existing, status: 'cancelled' });
      },
      async nextNumber(issueDate) {
        const [existing, profile] = await Promise.all([listInvoices(), store.get<SellerProfile>('profile', SELLER_ID)]);
        const fiscalYear = indianFiscalYear(issueDate);
        const sequence = nextSequence(
          existing.map((invoice) => invoice.number),
          fiscalYear,
        );
        return formatInvoiceNumber({ prefix: profile?.invoicePrefix ?? '', fiscalYear, sequence });
      },
    },

    themes: {
      list: () => store.list<InvoiceTheme>('themes'),
      save: (theme) => store.put('themes', theme),
      remove: (id) => store.remove('themes', id),
    },

    settings: {
      async get() {
        return (await store.get<InvoiceSettings>('settings', SETTINGS_ID)) ?? { ...DEFAULT_SETTINGS };
      },
      async update(patch) {
        const current = (await store.get<InvoiceSettings>('settings', SETTINGS_ID)) ?? { ...DEFAULT_SETTINGS };
        const next: InvoiceSettings = { ...current, ...patch, id: SETTINGS_ID };
        await store.put('settings', next);
        return next;
      },
    },
  };
}
