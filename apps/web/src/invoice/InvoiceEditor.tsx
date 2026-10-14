'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InvoiceNotValidError,
  InvoiceNumberTakenError,
  PRESET_THEMES,
  buildInvoiceDocument,
  issueInvoice,
  resolveTheme,
  type Client,
  type InvoiceDocument,
  type InvoiceRecord,
  type InvoiceStorage,
  type InvoiceTheme,
  type Issue,
  type SellerProfile,
} from '@solokit/tool-invoice';
import { Button, Notice } from '@solokit/ui';
import { ClientSection } from './ClientSection';
import { clientToForm, emptyClientForm, isBlankClient } from './clientFormState';
import { DetailsSection } from './DetailsSection';
import { editorToInvoice, invoiceToEditor, newEditorState, taxApplies, todayIso, validateEditor, type EditorState } from './editorModel';
import { invoiceFileName } from './fileName';
import { newId } from './ids';
import { LineItemsEditor } from './LineItemsEditor';
import { PdfPreview } from './PdfPreview';
import { issuesByField } from './profileFormState';
import { TotalsPanel } from './TotalsPanel';
import { defaultPdfRenderer, usePdfPreview, type PdfRenderer } from './usePdfPreview';
import styles from './InvoiceEditor.module.css';

export interface InvoiceEditorProps {
  storage: InvoiceStorage;
  profile: SellerProfile;
  /** An existing draft to edit. A new invoice is started when this is absent. */
  invoiceId?: string | undefined;
  onBack: () => void;
  onIssued: (id: string) => void;
  renderPdf?: PdfRenderer;
}

type Loaded = { kind: 'ready'; clients: Client[]; customThemes: InvoiceTheme[] } | { kind: 'cannot-edit' } | { kind: 'failed' };

const NUMBER_TAKEN = 'That invoice number is already used. Choose another.';

function safeDocument(invoice: InvoiceRecord | null): InvoiceDocument | null {
  if (!invoice) return null;
  try {
    return buildInvoiceDocument(invoice);
  } catch (error) {
    console.error('Could not build the invoice totals', error);
    return null;
  }
}

export function InvoiceEditor({ storage, profile, invoiceId, onBack, onIssued, renderPdf = defaultPdfRenderer }: InvoiceEditorProps) {
  const isNew = invoiceId === undefined;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [attempt, setAttempt] = useState<'none' | 'save' | 'issue'>('none');
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [savedMessage, setSavedMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [clients, settings, customThemes, existing] = await Promise.all([
        storage.clients.list(),
        storage.settings.get(),
        storage.themes.list(),
        invoiceId ? storage.invoices.get(invoiceId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      if (invoiceId) {
        if (!existing || existing.status !== 'draft') {
          setLoaded({ kind: 'cannot-edit' });
          return;
        }
        setState(invoiceToEditor(existing));
      } else {
        const today = todayIso(new Date());
        const number = await storage.invoices.nextNumber(today);
        if (cancelled) return;
        setState(
          newEditorState({ invoiceId: newId(), clientId: newId(), lineId: newId(), number, today, profile, defaultThemeId: settings.defaultThemeId }),
        );
      }
      setLoaded({ kind: 'ready', clients, customThemes });
    })().catch((error: unknown) => {
      console.error('Could not open the invoice editor', error);
      if (!cancelled) setLoaded({ kind: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [storage, invoiceId, profile]);

  // A new invoice's number follows the issue date's financial year until it is typed by hand.
  const issueDate = state?.issueDate;
  const numberEdited = state?.numberEdited;
  useEffect(() => {
    if (!isNew || issueDate === undefined || numberEdited) return;
    let cancelled = false;
    storage.invoices
      .nextNumber(issueDate)
      .then((number) => {
        if (!cancelled) setState((current) => (current && !current.numberEdited && current.issueDate === issueDate ? { ...current, number } : current));
      })
      .catch(() => {
        // An invalid or half-typed date: keep the current number.
      });
    return () => {
      cancelled = true;
    };
  }, [storage, isNew, issueDate, numberEdited]);

  const change = useCallback((patch: Partial<EditorState>) => {
    setSavedMessage(false);
    setServerIssues([]);
    setState((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const customThemes = loaded?.kind === 'ready' ? loaded.customThemes : [];
  const themes = useMemo(() => [...PRESET_THEMES, ...customThemes], [customThemes]);

  const built = useMemo(() => (state ? editorToInvoice(state, profile, new Date()) : null), [state, profile]);
  const issues = useMemo(() => (state ? validateEditor(state, profile, new Date()) : []), [state, profile]);
  // Saving a draft only complains about numbers that cannot be read; an Issue attempt shows every problem. Both then follow the form live.
  const errors = useMemo(() => {
    const shown = attempt === 'issue' ? issues : attempt === 'save' ? (built?.parseIssues ?? []) : [];
    return issuesByField([...shown, ...serverIssues]);
  }, [attempt, issues, built, serverIssues]);
  const previewInvoice = issues.length === 0 && built ? built.invoice : null;
  const theme = useMemo(() => resolveTheme(state?.themeId ?? 'classic', customThemes), [state?.themeId, customThemes]);
  const preview = usePdfPreview({ invoice: previewInvoice, theme, enabled: showPreview, render: renderPdf });
  const totalsDocument = useMemo(() => safeDocument(previewInvoice), [previewInvoice]);

  if (loaded === null || state === null) {
    if (loaded?.kind === 'cannot-edit' || loaded?.kind === 'failed') return renderProblem(loaded.kind, onBack);
    return <p>Opening the invoice…</p>;
  }
  if (loaded.kind !== 'ready') return renderProblem(loaded.kind, onBack);

  const taxed = taxApplies(state, profile);
  const clientErrors = errors;

  function focusFirstProblem() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function persistClient(invoice: InvoiceRecord) {
    if (state && state.saveClient && !isBlankClient(state.client)) await storage.clients.save(invoice.client);
  }

  async function handleSave(issue: boolean) {
    if (!state || !built || busy) return;
    setAttempt((previous) => (issue || previous === 'issue' ? 'issue' : 'save'));
    setSavedMessage(false);
    setServerIssues([]);
    if (issue ? issues.length > 0 : built.parseIssues.length > 0) {
      focusFirstProblem();
      return;
    }
    setBusy(true);
    try {
      if (issue) {
        const issued = issueInvoice(built.invoice);
        await persistClient(issued);
        const saved = await storage.invoices.save(issued);
        onIssued(saved.id);
        return;
      }
      const saved = await storage.invoices.save(built.invoice);
      await persistClient(saved);
      setState((current) => (current ? { ...current, createdAt: saved.createdAt } : current));
      setSavedMessage(true);
    } catch (error) {
      if (error instanceof InvoiceNumberTakenError) {
        setServerIssues([{ path: 'number', message: NUMBER_TAKEN }]);
        focusFirstProblem();
      } else if (error instanceof InvoiceNotValidError) {
        focusFirstProblem();
      } else {
        console.error('Could not save the invoice', error);
        setServerIssues([{ path: 'save', message: 'The invoice could not be saved. Please try again.' }]);
      }
    } finally {
      setBusy(false);
    }
  }

  // The summary belongs to a failed Issue attempt; a draft save shows its problems on the fields only.
  const shownIssues = attempt === 'issue' ? [...issues, ...serverIssues].filter((issue) => issue.path !== 'save') : [];

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h2 style={{ fontSize: '1.8rem' }}>{isNew ? 'New invoice' : 'Edit draft'}</h2>
        <Button variant="secondary" onClick={onBack}>
          Back to invoices
        </Button>
      </div>

      <div className={styles.layout}>
        <div className={styles.form} ref={formRef}>
          {shownIssues.length > 0 ? (
            <div className={styles.summary}>
              <Notice tone="danger" title={`Fix ${shownIssues.length} ${shownIssues.length === 1 ? 'thing' : 'things'} before you issue this invoice`}>
                <ul>
                  {shownIssues.map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Client</legend>
            <ClientSection
              value={state.client}
              clientId={state.clientId}
              savedClients={loaded.clients}
              isExport={state.isExport}
              saveClient={state.saveClient}
              errors={clientErrors}
              onChange={(client) =>
                change({
                  client,
                  ...(!state.placeEdited && !state.isExport ? { placeOfSupplyStateCode: client.stateCode } : {}),
                })
              }
              onSelectClient={(client) =>
                change(
                  client
                    ? {
                        clientId: client.id,
                        client: clientToForm(client),
                        saveClient: true,
                        ...(!state.placeEdited && !state.isExport ? { placeOfSupplyStateCode: client.address.stateCode ?? '' } : {}),
                      }
                    : { clientId: newId(), client: emptyClientForm(), saveClient: true },
                )
              }
              onSaveClientChange={(saveClient) => change({ saveClient })}
            />
          </fieldset>

          <DetailsSection state={state} onChange={change} profile={profile} themes={themes} errors={errors} />

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Items</legend>
            <LineItemsEditor
              lines={state.lines}
              onChange={(lines) => change({ lines })}
              taxApplies={taxed}
              currency={state.isExport ? state.currency : 'INR'}
              issueDate={state.issueDate}
              profile={profile}
              errors={errors}
            />
          </fieldset>

          <div className={styles.actions}>
            <Button variant="secondary" disabled={busy} onClick={() => void handleSave(false)}>
              Save draft
            </Button>
            <Button disabled={busy} onClick={() => void handleSave(true)}>
              Issue invoice
            </Button>
            {savedMessage ? (
              <span className={styles.status} role="status">
                Draft saved
              </span>
            ) : null}
          </div>
          {errors['save'] ? <Notice tone="danger">{errors['save']}</Notice> : null}
        </div>

        <aside className={styles.aside} aria-label="Totals and preview">
          <TotalsPanel document={totalsDocument} />
          <section className={styles.preview} aria-labelledby="preview-heading">
            <div className={styles.header}>
              <h3 id="preview-heading" style={{ fontSize: '1.25rem' }}>
                Preview
              </h3>
              <Button variant="secondary" onClick={() => setShowPreview((shown) => !shown)}>
                {showPreview ? 'Hide preview' : 'Show preview'}
              </Button>
            </div>
            {showPreview ? (
              <PdfPreview
                state={preview}
                filename={previewInvoice ? invoiceFileName(previewInvoice) : 'invoice.pdf'}
                onRetry={preview.retry}
                placeholder="Fill in the details to see the preview."
              />
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function renderProblem(kind: 'cannot-edit' | 'failed', onBack: () => void) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Notice tone="danger" title={kind === 'cannot-edit' ? 'This invoice cannot be edited' : 'The invoice could not be opened'}>
        {kind === 'cannot-edit'
          ? 'Only drafts can be edited. Issued invoices are locked so their numbers stay reliable. You can duplicate one as a new draft instead.'
          : 'Your browser could not read what was saved on this device. Go back and try again.'}
      </Notice>
      <div>
        <Button onClick={onBack}>Back to invoices</Button>
      </div>
    </div>
  );
}
