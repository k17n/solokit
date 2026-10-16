'use client';

import { useState } from 'react';
import type { ContractKind } from '@solokit/tool-contract';
import { Notice } from '@solokit/ui';
import { BackupScreen } from '../invoice/BackupScreen';
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

  if (!ready || !contracts || !invoice) return <p>Opening your agreements…</p>;

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
            <button key={tab.label} type="button" aria-current={tab.current.includes(view.name) ? 'page' : undefined} className={styles.tab} onClick={() => setView(tab.target)}>
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
            onBack={() => setView({ name: 'list' })}
            onFinalised={(id) => setView({ name: 'view', id })}
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
