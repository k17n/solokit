'use client';

import { useState } from 'react';
import type { Contract } from '@solokit/tool-contract';
import type { InvoiceTheme } from '@solokit/tool-invoice';
import { Button } from '@solokit/ui';
import { ContractPreview } from './ContractPreview';
import type { ContractExporter } from './exporters';
import { useContractPreview } from './useContractPreview';

export interface PreviewBlockProps {
  /** Null while the agreement is incomplete. */
  contract: Contract | null;
  theme: InvoiceTheme | null;
  exporter?: ContractExporter | undefined;
  placeholder: string;
}

/** The "Preview" heading, a show/hide button and the PDF. The PDF is only built while it is shown. */
export function PreviewBlock({ contract, theme, exporter, placeholder }: PreviewBlockProps) {
  const [shown, setShown] = useState(false);
  const preview = useContractPreview({ contract, theme, enabled: shown, ...(exporter ? { exporter } : {}) });
  return (
    <section aria-labelledby="preview-heading" style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <h4 id="preview-heading" style={{ fontSize: '1.25rem' }}>
          Preview of the agreement
        </h4>
        <Button variant="secondary" aria-expanded={shown} onClick={() => setShown((open) => !open)}>
          {shown ? 'Hide preview' : 'Show preview'}
        </Button>
      </div>
      {shown ? <ContractPreview state={preview} placeholder={placeholder} /> : null}
    </section>
  );
}
