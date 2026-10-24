'use client';

import { Button, Notice } from '@solokit/ui';
import type { ExportKind } from './exporters';

export interface ExportBarProps {
  onExport: (kind: ExportKind) => void;
  /** The download being built, if any. */
  busy: ExportKind | null;
  error?: string | null | undefined;
}

/** The four downloads: the agreement as PDF or editable Word, and the Review pack for a lawyer in either format. */
export function ExportBar({ onExport, busy, error }: ExportBarProps) {
  const button = (kind: ExportKind, label: string, variant: 'primary' | 'secondary' | 'ghost') => (
    <Button variant={variant} disabled={busy !== null} onClick={() => onExport(kind)}>
      {busy === kind ? 'Preparing…' : label}
    </Button>
  );
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div role="group" aria-label="Downloads" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {button('pdf', 'Download PDF', 'primary')}
        {button('docx', 'Download Word', 'secondary')}
        {button('review-pdf', 'Download review pack', 'secondary')}
        {button('review-docx', 'Review pack as Word', 'ghost')}
      </div>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        The Word file is editable, so your lawyer can mark it up. The review pack is the agreement followed by a summary of your choices and questions to ask a lawyer.
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
