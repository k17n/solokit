'use client';

import { useId, useState } from 'react';
import { Button, Notice } from '@solokit/ui';
import { ACCEPTED_LOGO_TYPES, LogoError, processLogoFile } from './logo';

export interface LogoFieldProps {
  value: string;
  onChange: (dataUrl: string) => void;
  process?: (file: File) => Promise<string>;
}

export function LogoField({ value, onChange, process = processLogoFile }: LogoFieldProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      onChange(await process(file));
    } catch (caught) {
      setError(caught instanceof LogoError ? caught.message : 'That image could not be used. Try a PNG or JPEG file.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <label htmlFor={inputId} style={{ fontWeight: 600 }}>
        Logo
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_LOGO_TYPES.join(',')}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Optional. It is shrunk on your device and printed at the top of your invoices.
      </p>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <img
            src={value}
            alt="Your logo"
            style={{ maxWidth: '12rem', maxHeight: '5rem', objectFit: 'contain', background: 'var(--surface-2)', borderRadius: 'var(--radius-s)', padding: '0.4rem' }}
          />
          <Button variant="secondary" onClick={() => onChange('')}>
            Remove logo
          </Button>
        </div>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
