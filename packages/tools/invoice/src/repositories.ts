import { formatInvoiceNumber, indianFiscalYear, nextSequence } from '@solokit/core';
import type { DataStore } from '@solokit/storage';
import { SELLER_ID, SETTINGS_ID, type Client, type InvoiceRecord, type InvoiceSettings, type SellerProfile } from './model';
import { DEFAULT_THEME_ID, type InvoiceTheme } from './themes';

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
    return all.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  }

  return {
    profile: {
      get: () => store.get<SellerProfile>('profile', SELLER_ID),
      save: (profile) => store.put('profile', { ...profile, id: SELLER_ID }),
    },

    clients: {
      list: async () => {
        const all = await store.list<Client>('clients');
        return all.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      },
      get: (id) => store.get<Client>('clients', id),
      save: (client) => store.put('clients', client),
      remove: (id) => store.remove('clients', id),
    },

    invoices: {
      list: listInvoices,
      get: (id) => store.get<InvoiceRecord>('invoices', id),
      async save(invoice) {
        const stamp = now().toISOString();
        const saved: InvoiceRecord = { ...invoice, createdAt: invoice.createdAt || stamp, updatedAt: stamp };
        await store.put('invoices', saved);
        return saved;
      },
      remove: (id) => store.remove('invoices', id),
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
