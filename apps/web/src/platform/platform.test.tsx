import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_API_VERSION, createPlatform, type FeatureId, type SyncAdapter } from '@solokit/platform';
import { createFakeEntitlements } from '@solokit/platform/testing';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { ContractViewer } from '../contract/ContractViewer';
import { fakeExporter, makeStorage, seedFinal } from '../contract/testSetup';
import { InvoiceViewer } from '../invoice/InvoiceViewer';
import { AppPlatform } from './AppPlatform';
import { PlatformProvider, useEntitlement, usePlatform, type SlotComponent, type WebPlugin } from './PlatformProvider';
import { ProSlot } from './ProSlot';
import { SHOW_UPSELL } from '../site';

function Has({ feature }: { feature: FeatureId }) {
  return <p>{feature}: {String(useEntitlement(feature))}</p>;
}

const PAID: FeatureId[] = ['cloud-sync', 'brand-kit-sync', 'hosted-invoice-links', 'email-sending', 'payment-reminders', 'payment-links', 'e-sign', 'e-invoice-irn', 'team-members', 'custom-domain'];

describe('the app with no plugin', () => {
  it('has the upsell switched off in the site config', () => {
    expect(SHOW_UPSELL).toBe(false);
  });

  it('denies every paid feature, allows free ones, and renders nothing for a slot', () => {
    const { container } = render(
      <AppPlatform>
        {PAID.map((feature) => (
          <Has key={feature} feature={feature} />
        ))}
        <Has feature="local-tools" />
        <ProSlot name="invoice.viewer.actions" context={{ documentId: 'a', kind: 'invoice' }} />
        <ProSlot name="business.plans" />
      </AppPlatform>,
    );
    for (const feature of PAID) expect(screen.getByText(`${feature}: false`)).toBeInTheDocument();
    expect(screen.getByText('local-tools: true')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-upsell]')).toHaveLength(0);
    expect(container.querySelectorAll('p')).toHaveLength(PAID.length + 1);
  });

  it('works outside any provider as the free platform', () => {
    render(<Has feature="cloud-sync" />);
    expect(screen.getByText('cloud-sync: false')).toBeInTheDocument();
  });
});

describe('a fake plugin', () => {
  it('grants a feature, and the hook updates when the grant changes', () => {
    const entitlements = createFakeEntitlements();
    const plugin: WebPlugin = { apiVersion: PLATFORM_API_VERSION, entitlements };
    render(
      <AppPlatform plugin={plugin}>
        <Has feature="e-sign" />
      </AppPlatform>,
    );
    expect(screen.getByText('e-sign: false')).toBeInTheDocument();
    act(() => entitlements.grant('e-sign'));
    expect(screen.getByText('e-sign: true')).toBeInTheDocument();
  });

  it('registers a slot component that appears, with its context', () => {
    const plugin: WebPlugin = {
      apiVersion: PLATFORM_API_VERSION,
      slots: { 'invoice.viewer.actions': ({ documentId, kind }) => <button>Share {kind} {documentId}</button> },
    };
    render(
      <AppPlatform plugin={plugin}>
        <ProSlot name="invoice.viewer.actions" context={{ documentId: 'i1', kind: 'quote' }} />
        <ProSlot name="contract.viewer.actions" context={{ documentId: 'c1', kind: 'nda-mutual', final: true }} />
      </AppPlatform>,
    );
    expect(screen.getByRole('button', { name: 'Share quote i1' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('replaces the SyncAdapter', async () => {
    const sync: SyncAdapter = {
      available: true,
      conflictPolicy: 'keep-both',
      status: () => 'idle',
      lastSyncedAt: () => undefined,
      subscribe: () => () => {},
      push: vi.fn(async () => ({ ok: true as const, value: { syncedAt: '2026-10-17T00:00:00Z' } })),
      pull: async () => ({ ok: true as const, value: undefined }),
    };
    let seen: ReturnType<typeof usePlatform> | undefined;
    function Capture() {
      seen = usePlatform();
      return null;
    }
    render(
      <AppPlatform plugin={{ apiVersion: PLATFORM_API_VERSION, sync }}>
        <Capture />
      </AppPlatform>,
    );
    expect(seen?.sync).toBe(sync);
    expect(seen?.sharing.available).toBe(false);
    const snapshot = await createMemoryStore().exportAll();
    expect(await seen!.sync.push('w1', snapshot)).toEqual({ ok: true, value: { syncedAt: '2026-10-17T00:00:00Z' } });
  });
});

describe('upsell placeholder', () => {
  const free = createPlatform<SlotComponent<never>>();

  it('shows an honest placeholder in a slot only when showUpsell is on, and never for held features', () => {
    const { container, rerender } = render(
      <PlatformProvider platform={free}>
        <ProSlot name="contract.viewer.actions" context={{ documentId: 'c', kind: 'x', final: false }} />
      </PlatformProvider>,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <PlatformProvider platform={free} showUpsell>
        <ProSlot name="contract.viewer.actions" context={{ documentId: 'c', kind: 'x', final: false }} />
      </PlatformProvider>,
    );
    expect(screen.getByText(/Available in a paid plan \(coming soon\): .*E-signing/)).toBeInTheDocument();
    const granted = createPlatform<SlotComponent<never>>({ apiVersion: PLATFORM_API_VERSION, grant: ['hosted-invoice-links', 'e-sign'] });
    rerender(
      <PlatformProvider platform={granted} showUpsell>
        <ProSlot name="contract.viewer.actions" context={{ documentId: 'c', kind: 'x', final: false }} />
      </PlatformProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the viewers', () => {
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:view'), revokeObjectURL: vi.fn() });
  });
  const plugin: WebPlugin = {
    apiVersion: PLATFORM_API_VERSION,
    slots: {
      'invoice.viewer.actions': ({ documentId, kind }) => <button>Pro invoice {documentId} {kind}</button>,
      'contract.viewer.actions': ({ documentId, final }) => <button>Pro agreement {documentId} {String(final)}</button>,
    },
  };

  it('shows the invoice slot only for a plugin', async () => {
    const storage = createInvoiceStorage(createMemoryStore());
    await storage.profile.save(makeSeller());
    await storage.invoices.save(makeInvoice({ id: 'i1', status: 'issued' }));
    const view = (
      <InvoiceViewer storage={storage} invoiceId="i1" onBack={vi.fn()} onEdit={vi.fn()} renderPdf={async () => new Blob(['pdf'])} />
    );
    const first = render(view);
    await screen.findByRole('button', { name: 'Cancel invoice' });
    expect(screen.queryByText(/Pro invoice/)).toBeNull();
    first.unmount();
    render(<AppPlatform plugin={plugin}>{view}</AppPlatform>);
    expect(await screen.findByRole('button', { name: 'Pro invoice i1 invoice' })).toBeInTheDocument();
  });

  it('shows the agreement slot only for a plugin', async () => {
    const storage = await makeStorage();
    await seedFinal(storage.contracts);
    const view = <ContractViewer storage={storage.contracts} invoice={storage.invoice} contractId="final-nda-mutual" onBack={vi.fn()} onEdit={vi.fn()} exporter={fakeExporter()} />;
    const first = render(view);
    await screen.findByRole('button', { name: 'Reopen to edit' });
    expect(screen.queryByText(/Pro agreement/)).toBeNull();
    first.unmount();
    render(<AppPlatform plugin={plugin}>{view}</AppPlatform>);
    expect(await screen.findByRole('button', { name: 'Pro agreement final-nda-mutual true' })).toBeInTheDocument();
  });
});
