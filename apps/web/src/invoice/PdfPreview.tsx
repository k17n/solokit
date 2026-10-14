'use client';

import { Button, Notice } from '@solokit/ui';
import type { PdfPreviewState } from './usePdfPreview';

export interface PdfPreviewProps {
  state: PdfPreviewState;
  /** File name for the download link. */
  filename: string;
  onRetry: () => void;
  /** Shown when there is nothing to preview yet. */
  placeholder: string;
}

export function PdfPreview({ state, filename, onRetry, placeholder }: PdfPreviewProps) {
  if (state.status === 'error') {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Notice tone="danger" title="No preview">
          {state.error ?? 'The PDF could not be built. Try again.'}
        </Notice>
        <div>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </div>
    );
  }
  if (state.url === null) {
    return <p style={{ color: 'var(--text-muted)' }}>{state.status === 'rendering' ? 'Building the preview…' : placeholder}</p>;
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <iframe
        title="Invoice preview"
        src={state.url}
        style={{ width: '100%', height: '70vh', minHeight: '28rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-s)', background: '#fff' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <a href={state.url} target="_blank" rel="noopener noreferrer">
          Open in a new tab
        </a>
        <a href={state.url} download={filename}>
          Download PDF
        </a>
        {state.status === 'rendering' ? <span style={{ color: 'var(--text-muted)' }}>Updating the preview…</span> : null}
      </div>
    </div>
  );
}
