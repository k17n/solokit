'use client';

import { useEffect, useState } from 'react';
import { Button, Notice } from '@solokit/ui';
import type { ContractPreviewState } from './useContractPreview';

const PHONE = '(max-width: 40rem)';

/** True on a narrow screen, where a PDF inside a page does not scroll or zoom well. False where matchMedia does not exist. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return phone;
}

export interface ContractPreviewProps {
  state: ContractPreviewState;
  /** Shown when there is nothing to preview yet. */
  placeholder: string;
}

export function ContractPreview({ state, placeholder }: ContractPreviewProps) {
  const phone = useIsPhone();
  if (state.status === 'error') {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Notice tone="danger" title="No preview">
          {state.error ?? 'The agreement could not be built. Try again.'}
        </Notice>
        <div>
          <Button onClick={state.retry}>Try again</Button>
        </div>
      </div>
    );
  }
  if (state.url === null) {
    return <p style={{ color: 'var(--text-muted)' }}>{state.status === 'rendering' ? 'Building the preview…' : placeholder}</p>;
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {phone ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Phones cannot show a PDF inside the page. Open the preview in its own tab, where you can scroll and zoom.
        </p>
      ) : (
        <iframe
          title="Agreement preview"
          src={state.url}
          style={{ width: '100%', height: '75vh', minHeight: '30rem', border: '1px solid var(--ds-border-strong)', borderRadius: 'var(--ds-r-card)', background: '#fff' }}
        />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <a href={state.url} target="_blank" rel="noopener noreferrer">
          Open preview in a new tab
        </a>
        {state.status === 'rendering' ? <span style={{ color: 'var(--text-muted)' }}>Updating the preview…</span> : null}
      </div>
    </div>
  );
}
