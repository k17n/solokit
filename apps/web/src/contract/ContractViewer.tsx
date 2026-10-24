'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { type Contract, type ContractStorage } from '@solokit/tool-contract';
import type { InvoiceSettings, InvoiceStorage, InvoiceTheme } from '@solokit/tool-invoice';
import { Button, Notice, formatIsoDate } from '@solokit/ui';
import { downloadBlob } from '../invoice/downloads';
import { ProSlot } from '../platform/ProSlot';
import { newId } from '../invoice/ids';
import styles from './ContractEditor.module.css';
import { displayTitle, partiesLine, StatusBadge } from './ContractList';
import { ExportBar } from './ExportBar';
import { KindBanner } from './kinds';
import { PreviewBlock } from './PreviewBlock';
import { ReviewPanel } from './ReviewPanel';
import { safeSummary } from './editorModel';
import { defaultExporter, describeExportError, type ContractExporter, type ExportKind } from './exporters';
import { themeFor } from './themes';

export interface ContractViewerProps {
  storage: ContractStorage;
  invoice: InvoiceStorage;
  contractId: string;
  onBack: () => void;
  /** Opens a draft in the editor, after a reopen or a duplicate. */
  onEdit: (id: string) => void;
  exporter?: ContractExporter;
}

type Loaded = { contract: Contract; settings: InvoiceSettings; customThemes: InvoiceTheme[] };

/** A final agreement: read-only, with its downloads and review. Reopen turns it back into a draft. */
export function ContractViewer({ storage, invoice, contractId, onBack, onEdit, exporter = defaultExporter }: ContractViewerProps) {
  const [loaded, setLoaded] = useState<Loaded | 'missing' | 'failed' | null>(null);
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const reopenRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([storage.get(contractId), invoice.settings.get(), invoice.themes.list()])
      .then(([contract, settings, customThemes]) => {
        if (cancelled) return;
        setLoaded(contract ? { contract, settings, customThemes } : 'missing');
      })
      .catch((failure: unknown) => {
        console.error('Could not open the agreement', failure);
        if (!cancelled) setLoaded('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [storage, invoice, contractId]);

  useEffect(() => {
    if (confirmingReopen) confirmRef.current?.focus();
  }, [confirmingReopen]);

  const contract = typeof loaded === 'object' && loaded !== null ? loaded.contract : null;
  const theme = useMemo(() => (typeof loaded === 'object' && loaded !== null ? themeFor(loaded.contract, loaded.settings, loaded.customThemes) : null), [loaded]);
  const summary = useMemo(() => safeSummary(contract), [contract]);

  if (loaded === null) return <p>Opening the agreement…</p>;
  if (loaded === 'missing' || loaded === 'failed' || !contract || !theme) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Notice tone="danger" title="The agreement could not be opened">
          {loaded === 'missing' ? 'It may have been deleted. Go back to the list.' : 'Your browser could not read what was saved on this device. Go back and try again.'}
        </Notice>
        <div>
          <Button onClick={onBack}>Back to agreements</Button>
        </div>
      </div>
    );
  }
  const current = contract;
  const final = current.status === 'final';

  async function reopen() {
    setBusy(true);
    setError(null);
    try {
      await storage.reopen(current.id);
      onEdit(current.id);
    } catch (failure) {
      console.error('Could not reopen the agreement', failure);
      setError('The agreement could not be reopened. Try again.');
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const copy = await storage.duplicate(current.id, { id: newId() });
      onEdit(copy.id);
    } catch (failure) {
      console.error('Could not duplicate the agreement', failure);
      setError('The agreement could not be duplicated. Try again.');
      setBusy(false);
    }
  }

  async function runExport(kind: ExportKind) {
    setExportError(null);
    setExporting(kind);
    try {
      const { blob, filename } = await exporter(kind, { contract: current, theme: theme as InvoiceTheme });
      downloadBlob(blob, filename);
    } catch (failure) {
      console.error('Could not build the agreement', failure);
      setExportError(describeExportError(failure));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h2 style={{ fontSize: '1.5rem' }}>{displayTitle(current)}</h2>
        <Button variant="secondary" onClick={onBack}>
          Back to agreements
        </Button>
      </div>

      <KindBanner kind={current.kind}>
        <StatusBadge status={current.status} />
      </KindBanner>

      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
        {partiesLine(current)} · effective {formatIsoDate(current.effectiveDate)}
      </p>

      {final ? (
        <Notice tone="info" title="This agreement is final">
          Its wording is locked, so the copy you sign is the copy you saved, even if SoloKit&apos;s templates change later. Download it below. To change anything, use Reopen: it turns the agreement back into a draft.
        </Notice>
      ) : null}

      <div className={styles.confirm}>
        {confirmingReopen ? (
          <>
            <p ref={confirmRef} tabIndex={-1}>
              Reopen this agreement? It becomes a draft again, so you can change it. Its locked wording is dropped, and you finalise it again when you are done.
            </p>
            <div className={styles.barActions}>
              <Button disabled={busy} onClick={() => void reopen()}>
                Yes, reopen
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmingReopen(false);
                  requestAnimationFrame(() => reopenRef.current?.querySelector('button')?.focus());
                }}
              >
                Keep it final
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.barActions}>
            {final ? (
              <span ref={reopenRef}>
                <Button variant="secondary" disabled={busy} onClick={() => setConfirmingReopen(true)}>
                  Reopen to edit
                </Button>
              </span>
            ) : null}
            <Button variant="ghost" disabled={busy} onClick={() => void duplicate()}>
              Duplicate as a new draft
            </Button>
            <ProSlot name="contract.viewer.actions" context={{ documentId: current.id, kind: current.kind, final }} />
          </div>
        )}
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </div>

      <Notice tone="warning" title="Template, not legal advice">
        Have it reviewed before you sign. The review pack is made to send to a lawyer. Nothing here leaves your device.
      </Notice>

      <PreviewBlock contract={current} theme={theme} exporter={exporter} placeholder="Building the preview…" />

      <section aria-labelledby="export-heading" style={{ display: 'grid', gap: '0.75rem' }}>
        <h4 id="export-heading" className={styles.subhead}>
          Download
        </h4>
        <ExportBar onExport={(kind) => void runExport(kind)} busy={exporting} error={exportError} />
      </section>

      {summary ? (
        <section aria-labelledby="summary-heading" style={{ display: 'grid', gap: '0.75rem' }}>
          <h4 id="summary-heading" className={styles.subhead}>
            Review summary
          </h4>
          <ReviewPanel summary={summary} />
        </section>
      ) : null}
    </div>
  );
}
