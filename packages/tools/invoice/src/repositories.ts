import { formatInvoiceNumber, indianFiscalYear, nextSequence } from '@solokit/core';
import type { DataStore } from '@solokit/storage';
import { createProfileRepository, type BusinessProfile } from '@solokit/profile';
import { SETTINGS_ID, type Client, type InvoiceKind, type InvoiceRecord, type InvoiceSettings } from './model';
import { numberSeriesOf, seriesOf, seriesPrefix } from './series';
import { convertToInvoice } from './convert';
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

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionError';
  }
}

export interface InvoiceStorageOptions {
  now?: () => Date;
}

export interface InvoiceStorage {
  profile: {
    get(): Promise<BusinessProfile | undefined>;
    save(profile: BusinessProfile): Promise<void>;
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
    /**
     * Turns an issued quote or proforma into a new draft tax invoice (next number in the tax series, current
     * profile) and links the two. The source stays issued and read-only. Throws {@link ConversionError}.
     */
    convert(id: string, input: { id: string; issueDate: string }): Promise<InvoiceRecord>;
    /** The next free number in the series of this kind (default: tax invoices). */
    nextNumber(issueDate: string, kind?: InvoiceKind): Promise<string>;
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
  const profileRepo = createProfileRepository(store);

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
    if (all.some((other) => other.id !== invoice.id && numberSeriesOf(other) === numberSeriesOf(invoice) && key(other.number) === key(invoice.number))) {
      throw new InvoiceNumberTakenError(`Invoice number ${invoice.number} is already used by another invoice`);
    }
    const stamp = now().toISOString();
    const saved: InvoiceRecord = { ...invoice, createdAt: invoice.createdAt || stamp, updatedAt: stamp };
    await store.put('invoices', saved);
    return saved;
  }

  async function nextNumber(issueDate: string, kind: InvoiceKind = 'invoice'): Promise<string> {
    const [existing, profile] = await Promise.all([listInvoices(), profileRepo.get()]);
    const fiscalYear = indianFiscalYear(issueDate);
    const sequence = nextSequence(
      existing.filter((invoice) => numberSeriesOf(invoice) === kind).map((invoice) => invoice.number),
      fiscalYear,
    );
    return formatInvoiceNumber({ prefix: seriesPrefix(kind, profile?.invoicePrefix ?? ''), fiscalYear, sequence });
  }

  return {
    profile: profileRepo,

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
        // Deleting the draft made from a quote frees the quote to be converted again.
        const sourceId = existing?.convertedFromId;
        const source = sourceId ? await store.get<InvoiceRecord>('invoices', sourceId) : undefined;
        if (source && source.convertedToId === id) {
          const { convertedToId: _linked, ...rest } = source;
          await saveInvoice(rest);
        }
      },
      async cancel(id) {
        const existing = await store.get<InvoiceRecord>('invoices', id);
        if (!existing) throw new Error('Invoice not found');
        if (existing.status === 'draft') throw new Error('Only issued invoices can be cancelled; delete a draft instead');
        return saveInvoice({ ...existing, status: 'cancelled' });
      },
      async convert(id, input) {
        const source = await store.get<InvoiceRecord>('invoices', id);
        if (!source) throw new ConversionError('Document not found');
        if (seriesOf(source) === 'invoice') throw new ConversionError('Only a quotation or proforma invoice can be converted');
        if (source.status !== 'issued') throw new ConversionError('Only an issued quotation or proforma invoice can be converted');
        if (source.convertedToId) throw new ConversionError('This document has already been converted to an invoice');
        // An earlier attempt may have saved the draft and been cut off before linking; use that draft.
        const earlier = (await store.list<InvoiceRecord>('invoices')).find((other) => other.convertedFromId === source.id && other.status === 'draft');
        if (earlier) {
          await saveInvoice({ ...source, convertedToId: earlier.id });
          return earlier;
        }
        const [number, profile] = await Promise.all([nextNumber(input.issueDate, 'invoice'), profileRepo.get()]);
        const draft = convertToInvoice(source, { id: input.id, number, issueDate: input.issueDate, now: now(), ...(profile ? { seller: profile } : {}) });
        // Check again just before writing: the document may have been converted while the number was worked out.
        const latest = await store.get<InvoiceRecord>('invoices', id);
        if (!latest || latest.convertedToId) throw new ConversionError('This document has already been converted to an invoice');
        const saved = await saveInvoice(draft);
        try {
          await saveInvoice({ ...latest, convertedToId: saved.id });
        } catch (error) {
          // Without the link the document could be converted twice, so do not leave the draft behind.
          await store.remove('invoices', saved.id).catch(() => undefined);
          throw error;
        }
        return saved;
      },
      nextNumber,
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
