'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ContractInvalidError,
  KIND_LABELS,
  createContractDraft,
  type Contract,
  type ContractKind,
  type ContractStorage,
} from '@solokit/tool-contract';
import type { Client, InvoiceSettings, InvoiceStorage, InvoiceTheme, SellerProfile } from '@solokit/tool-invoice';
import { Button, Notice, TextField } from '@solokit/ui';
import { downloadBlob } from '../invoice/downloads';
import { todayIso } from '../invoice/editorModel';
import { newId } from '../invoice/ids';
import { requestPersistentStorage } from '../invoice/persist';
import styles from './ContractEditor.module.css';
import { ClausesSection } from './ClausesSection';
import { ExportBar } from './ExportBar';
import { JurisdictionSection } from './JurisdictionSection';
import { KindBanner } from './kinds';
import { PartiesSection } from './PartiesSection';
import { PreviewBlock } from './PreviewBlock';
import { ReviewPanel } from './ReviewPanel';
import { TermsSection } from './TermsSection';
import { SECTION_LABEL, byField, collectIssues, fillParty, safeSummary, sectionOf, signatureOf, suggestedTitle, type PartyChoice } from './editorModel';
import { defaultExporter, describeExportError, type ContractExporter, type ExportKind } from './exporters';
import { themeFor } from './themes';

export interface ContractEditorProps {
  storage: ContractStorage;
  invoice: InvoiceStorage;
  /** An existing draft to edit. A new agreement is started when this is absent. */
  contractId?: string | undefined;
  /** The kind of a new agreement. */
  initialKind?: ContractKind | undefined;
  onBack: () => void;
  /** Called once the agreement is final. */
  onFinalised: (id: string) => void;
  exporter?: ContractExporter;
  /** The current time. Tests pass a fixed one. */
  now?: () => Date;
}

const realNow = () => new Date();

type Loaded =
  | { kind: 'ready'; profile: SellerProfile | undefined; clients: Client[]; settings: InvoiceSettings; customThemes: InvoiceTheme[] }
  | { kind: 'cannot-edit' }
  | { kind: 'failed' };

function choicesFrom(profile: SellerProfile | undefined, clients: Client[]): PartyChoice[] {
  const choices: PartyChoice[] = [];
  if (profile) choices.push({ id: 'profile', label: `My business profile (${profile.name})`, source: { name: profile.name, address: profile.address, email: profile.email, pan: profile.pan, gstin: profile.gstin } });
  for (const client of clients) {
    choices.push({ id: `client-${client.id}`, label: client.name, source: { name: client.name, address: client.address, email: client.email, pan: client.pan, gstin: client.gstin } });
  }
  return choices;
}

function Section({ id, number, title, lead, children }: { id: string; number: number; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHead}>
        <h3 id={`${id}-title`} className={styles.sectionTitle}>
          <span className={styles.stepNum} aria-hidden="true">
            {number}
          </span>
          {title}
        </h3>
        <p className={styles.sectionLead}>{lead}</p>
      </div>
      {children}
    </section>
  );
}

export function ContractEditor({ storage, invoice, contractId, initialKind = 'nda-mutual', onBack, onFinalised, exporter = defaultExporter, now = realNow }: ContractEditorProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  /** What the user typed into number fields, which can be something that is not a number yet. */
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [savedSignature, setSavedSignature] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'finalise' | 'leave' | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const finaliseRef = useRef<HTMLSpanElement>(null);
  const askedPersist = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profile, clients, settings, customThemes, existing] = await Promise.all([
        invoice.profile.get(),
        invoice.clients.list(),
        invoice.settings.get(),
        invoice.themes.list(),
        contractId ? storage.get(contractId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      if (contractId) {
        if (!existing || existing.status !== 'draft') {
          setLoaded({ kind: 'cannot-edit' });
          return;
        }
        setContract(existing);
        setSavedSignature(signatureOf(existing));
      } else {
        const stamp = now();
        let draft = createContractDraft({ id: newId(), kind: initialKind, now: stamp, effectiveDate: todayIso(stamp) });
        // The first party is usually the person using the tool, so their details start filled in.
        if (profile) draft = fillParty(draft, 0, { name: profile.name, address: profile.address, email: profile.email, pan: profile.pan, gstin: profile.gstin });
        setContract(draft);
        setSavedSignature(signatureOf(draft));
      }
      setLoaded({ kind: 'ready', profile, clients, settings, customThemes });
    })().catch((error: unknown) => {
      console.error('Could not open the agreement editor', error);
      if (!cancelled) setLoaded({ kind: 'failed' });
    });
    return () => {
      cancelled = true;
    };
    // `now` is only read once, when a new agreement is started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, invoice, contractId]);

  const change = useCallback((next: Contract) => {
    setSaved(false);
    setSaveError(null);
    setExportError(null);
    setContract(next);
  }, []);

  /** The agreement as it will be saved and printed: an empty name becomes a suggested one. */
  const working = useMemo(() => (contract && contract.title.trim() === '' ? { ...contract, title: suggestedTitle(contract) } : contract), [contract]);
  const issues = useMemo(() => (working ? collectIssues(working, typed) : []), [working, typed]);
  const errors = useMemo(() => (attempted ? byField(issues) : {}), [attempted, issues]);
  const complete = issues.length === 0;
  const printable = complete ? working : null;
  const summary = useMemo(() => safeSummary(printable), [printable]);
  const dirty = contract !== null && signatureOf(contract) !== savedSignature;
  const customThemes = loaded?.kind === 'ready' ? loaded.customThemes : [];
  const theme = useMemo(() => (working && loaded?.kind === 'ready' ? themeFor(working, loaded.settings, customThemes) : null), [working, loaded, customThemes]);
  const choices = useMemo(() => (loaded?.kind === 'ready' ? choicesFrom(loaded.profile, loaded.clients) : []), [loaded]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (loaded === null || contract === null || working === null) {
    if (loaded?.kind === 'cannot-edit' || loaded?.kind === 'failed') return renderProblem(loaded.kind, onBack);
    return <p>Opening the agreement…</p>;
  }
  if (loaded.kind !== 'ready') return renderProblem(loaded.kind, onBack);

  const current = working;

  function focusFirstProblem() {
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-problem]');
      (field ?? summaryRef.current)?.focus();
    });
  }

  async function persist(): Promise<Contract> {
    const savedContract = await storage.save(current);
    setContract(savedContract);
    setSavedSignature(signatureOf(savedContract));
    if (!askedPersist.current) {
      askedPersist.current = true;
      void requestPersistentStorage();
    }
    return savedContract;
  }

  async function saveDraft(): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setSaveError(null);
    try {
      await persist();
      setSaved(true);
      return true;
    } catch (error) {
      console.error('Could not save the agreement', error);
      setSaveError('The agreement could not be saved. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startFinalise() {
    setAttempted(true);
    setSaved(false);
    if (!complete) {
      focusFirstProblem();
      return;
    }
    setConfirming('finalise');
  }

  async function finalise() {
    setBusy(true);
    setSaveError(null);
    try {
      await persist();
      const done = await storage.finalise(current.id);
      onFinalised(done.id);
    } catch (error) {
      if (error instanceof ContractInvalidError) {
        setConfirming(null);
        setAttempted(true);
        focusFirstProblem();
      } else {
        console.error('Could not finalise the agreement', error);
        setConfirming(null);
        setSaveError('The agreement could not be finalised. Please try again.');
      }
      setBusy(false);
    }
  }

  async function runExport(kind: ExportKind) {
    setAttempted(true);
    setExportError(null);
    if (!complete || !theme) {
      focusFirstProblem();
      return;
    }
    setExporting(kind);
    try {
      const { blob, filename } = await exporter(kind, { contract: current, theme });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Could not build the agreement', error);
      setExportError(describeExportError(error));
    } finally {
      setExporting(null);
    }
  }

  async function leave(save: boolean) {
    if (save && !(await saveDraft())) {
      setConfirming(null);
      return;
    }
    onBack();
  }

  const shown = attempted ? issues : [];
  const hasProfile = loaded.profile !== undefined;
  const kindName = KIND_LABELS[current.kind];

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h2 style={{ fontSize: '1.8rem' }}>{contractId ? 'Edit draft' : `New ${kindName.toLowerCase()}`}</h2>
        <Button variant="secondary" onClick={() => (dirty ? setConfirming('leave') : onBack())}>
          Back to agreements
        </Button>
      </div>

      <KindBanner kind={current.kind} />

      <nav aria-label="Sections of this agreement">
        <ol className={styles.steps}>
          {[
            ['sec-parties', 'Parties'],
            ['sec-terms', 'Key terms'],
            ['sec-clauses', 'Optional clauses'],
            ['sec-jurisdiction', 'Jurisdiction'],
            ['sec-review', 'Review'],
          ].map(([id, label], index) => (
            <li key={id}>
              <a href={`#${id}`}>
                <span className={styles.stepNum} aria-hidden="true">
                  {index + 1}
                </span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={styles.form} ref={formRef}>
        {shown.length > 0 ? (
          <div className={styles.summary} ref={summaryRef} tabIndex={-1}>
            <Notice tone="danger" title={`Fix ${shown.length} ${shown.length === 1 ? 'thing' : 'things'} before you finalise or download this agreement`}>
              <ul>
                {shown.map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>
                    {SECTION_LABEL[sectionOf(issue.path)]}: {issue.message}
                  </li>
                ))}
              </ul>
            </Notice>
          </div>
        ) : null}

        <div className={styles.nameBlock}>
          <TextField
            label="Agreement name"
            hint="Only for you: it appears in your list and names the files. It is not printed in the agreement."
            autoComplete="off"
            placeholder={suggestedTitle(contract)}
            value={contract.title}
            onChange={(event) => change({ ...contract, title: event.target.value })}
          />
        </div>

        <Section id="sec-parties" number={1} title="Parties" lead="Who is signing. Use the legal names, as they should appear on the agreement.">
          <PartiesSection contract={contract} errors={errors} choices={choices} hasProfile={hasProfile} onChange={change} />
        </Section>

        <Section id="sec-terms" number={2} title="Key terms" lead="The numbers and choices that make this agreement yours. Anything you leave empty uses the template's default, and the review below lists which ones.">
          <TermsSection contract={contract} typed={typed} errors={errors} onChange={change} onTyped={(id, text) => setTyped((previous) => ({ ...previous, [id]: text }))} />
        </Section>

        <Section id="sec-clauses" number={3} title="Optional clauses" lead="Extra protections you can include or leave out.">
          <ClausesSection contract={contract} errors={errors} onChange={change} />
        </Section>

        <Section id="sec-jurisdiction" number={4} title="Jurisdiction and stamp duty" lead="Which courts handle a dispute, and what to check about stamp duty where you are.">
          <JurisdictionSection contract={contract} errors={errors} onChange={change} />
        </Section>

        <Section id="sec-review" number={5} title="Review" lead="Read the agreement, check your choices, then download it or finalise it.">
          <div className={styles.review}>
            <Notice tone="warning" title="Template, not legal advice">
              Have it reviewed before you sign. The review pack below is made to send to a lawyer. Nothing here leaves your device.
            </Notice>
            {!complete ? (
              <Notice tone="info" title="The preview and summary appear when sections 1 to 4 are complete">
                {issues.length} {issues.length === 1 ? 'item is' : 'items are'} still missing. Use Finalise or a download button to see what.
              </Notice>
            ) : null}
            <PreviewBlock contract={printable} theme={theme} exporter={exporter} placeholder="Fill in the details to see the preview." />
            {summary ? (
              <section aria-labelledby="summary-heading" style={{ display: 'grid', gap: '0.75rem' }}>
                <h4 id="summary-heading" className={styles.subhead}>
                  Review summary
                </h4>
                <ReviewPanel summary={summary} />
              </section>
            ) : null}
            <section aria-labelledby="export-heading" style={{ display: 'grid', gap: '0.75rem' }}>
              <h4 id="export-heading" className={styles.subhead}>
                Download
              </h4>
              <ExportBar onExport={(kind) => void runExport(kind)} busy={exporting} error={exportError} />
            </section>
          </div>
        </Section>

        <div className={styles.bar} role="region" aria-label="Save and finalise">
          {confirming === 'finalise' ? (
            <div className={styles.confirm}>
              <p ref={confirmRef} tabIndex={-1}>
                Finalise this agreement? Its wording is locked so the copy you sign cannot change by accident. You can still download it, and use Reopen to edit it again.
              </p>
              <div className={styles.barActions}>
                <Button disabled={busy} onClick={() => void finalise()}>
                  Yes, finalise
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirming(null);
                    requestAnimationFrame(() => finaliseRef.current?.querySelector('button')?.focus());
                  }}
                >
                  Keep editing
                </Button>
              </div>
            </div>
          ) : confirming === 'leave' ? (
            <div className={styles.confirm}>
              <p ref={confirmRef} tabIndex={-1}>
                You have changes that are not saved.
              </p>
              <div className={styles.barActions}>
                <Button disabled={busy} onClick={() => void leave(true)}>
                  Save draft and leave
                </Button>
                <Button variant="secondary" onClick={() => void leave(false)}>
                  Leave without saving
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)}>
                  Keep editing
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.barActions}>
              <Button variant="secondary" disabled={busy} onClick={() => void saveDraft()}>
                Save draft
              </Button>
              <span ref={finaliseRef}>
                <Button disabled={busy} onClick={startFinalise}>
                  Finalise agreement
                </Button>
              </span>
              <span className={styles.status} role="status">
                {saved ? 'Draft saved' : dirty ? 'Unsaved changes' : ''}
              </span>
            </div>
          )}
          {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
        </div>
      </div>
    </div>
  );
}

function renderProblem(kind: 'cannot-edit' | 'failed', onBack: () => void) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Notice tone="danger" title={kind === 'cannot-edit' ? 'This agreement cannot be edited' : 'The agreement could not be opened'}>
        {kind === 'cannot-edit'
          ? 'Only drafts can be edited. A final agreement is locked so the wording stays as it was signed. Reopen it from the list to edit it, or duplicate it as a new draft.'
          : 'Your browser could not read what was saved on this device. Go back and try again.'}
      </Notice>
      <div>
        <Button onClick={onBack}>Back to agreements</Button>
      </div>
    </div>
  );
}
