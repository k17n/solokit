'use client';

import { useCallback, useEffect, useState } from 'react';
import { missingFields, type BusinessProfile } from '@solokit/profile';
import type { ContractKind } from '@solokit/tool-contract';
import { Notice } from '@solokit/ui';
import { BackupScreen } from '../business/BackupScreen';
import { Onboarding } from '../business/Onboarding';
import { useProfileSaver } from '../business/useProfileSaver';
import { ContractEditor } from './ContractEditor';
import { ContractList } from './ContractList';
import { ContractViewer } from './ContractViewer';
import type { ContractExporter } from './exporters';
import { useContractStorage } from './useContractStorage';
import styles from './ContractApp.module.css';

type View = { name: 'list' } | { name: 'new'; kind: ContractKind } | { name: 'edit'; id: string } | { name: 'view'; id: string } | { name: 'backup' };

const TABS: { label: string; target: View; current: View['name'][] }[] = [
  { label: 'Agreements', target: { name: 'list' }, current: ['list', 'new', 'edit', 'view'] },
  { label: 'Backup & restore', target: { name: 'backup' }, current: ['backup'] },
];

export function ContractApp({ exporter, now }: { exporter?: ContractExporter; now?: () => Date } = {}) {
  const { contracts, invoice, store, ready, persistent } = useContractStorage(now);
  const [view, setView] = useState<View>({ name: 'list' });
  /** Changes every time a new agreement is started, so the editor starts fresh even when it is already open. */
  const [newCount, setNewCount] = useState(0);
  /** Changes after a restore, so the list reloads what is now on the device. */
  const [restoreCount, setRestoreCount] = useState(0);
  /** Whether the open editor has changes that are not saved. */
  const [editorDirty, setEditorDirty] = useState(false);
  /** Where a tab click wanted to go while the editor still had unsaved changes. */
  const [pending, setPending] = useState<View | null>(null);
  /** Changes each time a tab is clicked in a dirty editor, which makes the editor ask what to do with its changes. */
  const [leaveRequest, setLeaveRequest] = useState(0);
  const onDirtyChange = useCallback((dirty: boolean) => setEditorDirty(dirty), []);
  /** The Business's shared profile: undefined while it is being read, null when there is none. */
  const [profile, setProfile] = useState<BusinessProfile | null | undefined>(undefined);
  /** The person chose to go on without filling in their details (or they could not be read). */
  const [skipped, setSkipped] = useState(false);
  const saveBusiness = useProfileSaver(invoice);

  useEffect(() => {
    if (!invoice) return;
    let cancelled = false;
    invoice.profile.get().then(
      (found) => {
        if (!cancelled) setProfile(found ?? null);
      },
      (error: unknown) => {
        // Asking for details again could overwrite ones that merely failed to load, so go on without asking.
        console.error('Could not read the saved profile', error);
        if (!cancelled) {
          setProfile(null);
          setSkipped(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [invoice, restoreCount]);

  if (!ready || !contracts || !invoice || profile === undefined) return <p>Opening your agreements…</p>;

  // First use of the tool: ask only for the details agreements need that this Business has not given yet.
  if (!skipped && missingFields(profile ?? undefined, 'contract').length > 0) {
    return (
      <div className={styles.app}>
        {!persistent ? (
          <Notice tone="danger" title="Your browser is not saving data">
            What you enter will be lost when you close this tab. Use a normal browser window so your work is kept.
          </Notice>
        ) : null}
        <Onboarding
          tool="contract"
          profile={profile ?? undefined}
          onSkip={() => setSkipped(true)}
          onDone={async (next) => {
            setProfile(await saveBusiness(next, profile));
          }}
        />
      </div>
    );
  }

  /** Go to a tab, unless the editor holds unsaved changes: then the editor asks first, as it does for its own Back button. */
  function goTo(target: View) {
    if (editorDirty && (view.name === 'new' || view.name === 'edit')) {
      setPending(target);
      setLeaveRequest((count) => count + 1);
      return;
    }
    setView(target);
  }

  const optional = { ...(exporter ? { exporter } : {}), ...(now ? { now } : {}) };

  return (
    <div className={styles.app}>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window so your work is kept, or download a backup from the Backup &amp; restore tab before you leave.
        </Notice>
      ) : null}
      <nav aria-label="Contract tool">
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button key={tab.label} type="button" aria-current={tab.current.includes(view.name) ? 'page' : undefined} className={styles.tab} onClick={() => goTo(tab.target)}>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <p className={styles.disclaimer}>
        <strong>Template, not legal advice.</strong> Have it reviewed before you sign. Everything stays on your device.
      </p>
      <div className={styles.panel}>
        {view.name === 'list' ? (
          <ContractList
            key={restoreCount}
            storage={contracts}
            invoice={invoice}
            onNew={(kind) => {
              setNewCount((count) => count + 1);
              setView({ name: 'new', kind });
            }}
            onEdit={(id) => setView({ name: 'edit', id })}
            onView={(id) => setView({ name: 'view', id })}
            onOpenBackup={() => setView({ name: 'backup' })}
            {...optional}
          />
        ) : null}
        {view.name === 'new' || view.name === 'edit' ? (
          <ContractEditor
            key={view.name === 'edit' ? view.id : `new-${newCount}`}
            storage={contracts}
            invoice={invoice}
            contractId={view.name === 'edit' ? view.id : undefined}
            initialKind={view.name === 'new' ? view.kind : undefined}
            onBack={() => {
              setView(pending ?? { name: 'list' });
              setPending(null);
            }}
            onFinalised={(id) => {
              setPending(null);
              setView({ name: 'view', id });
            }}
            onDirtyChange={onDirtyChange}
            leaveRequest={leaveRequest}
            onStay={() => setPending(null)}
            {...optional}
          />
        ) : null}
        {view.name === 'view' ? (
          <ContractViewer
            key={view.id}
            storage={contracts}
            invoice={invoice}
            contractId={view.id}
            onBack={() => setView({ name: 'list' })}
            onEdit={(id) => setView({ name: 'edit', id })}
            {...(exporter ? { exporter } : {})}
          />
        ) : null}
        {view.name === 'backup' && store ? (
          <BackupScreen store={store} onRestored={() => setRestoreCount((count) => count + 1)} {...(now ? { now } : {})} />
        ) : null}
      </div>
    </div>
  );
}
