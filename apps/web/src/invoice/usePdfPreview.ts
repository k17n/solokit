'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InvoiceRecord, InvoiceTheme } from '@solokit/tool-invoice';

export type PdfRenderer = (input: { invoice: InvoiceRecord; theme: InvoiceTheme }) => Promise<Blob>;

/** Loads the PDF engine only when a preview or download is needed. */
export const defaultPdfRenderer: PdfRenderer = async (input) => {
  const { renderInvoicePdf } = await import('@solokit/tool-invoice-pdf');
  return renderInvoicePdf({ ...input, fontBase: '/fonts/invoice' });
};

export type PreviewStatus = 'idle' | 'rendering' | 'ready' | 'error';

export interface PdfPreviewState {
  status: PreviewStatus;
  /** The most recent successfully built PDF. Kept while a newer one is being built. */
  url: string | null;
  error: string | null;
  retry: () => void;
}

export interface UsePdfPreviewInput {
  invoice: InvoiceRecord | null;
  theme: InvoiceTheme | null;
  enabled: boolean;
  delayMs?: number;
  render?: PdfRenderer;
}

function describeError(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(text)) {
    return 'The PDF tools could not be loaded. Check your connection and try again.';
  }
  return 'The PDF could not be built. Try again.';
}

export function usePdfPreview({ invoice, theme, enabled, delayMs = 500, render = defaultPdfRenderer }: UsePdfPreviewInput): PdfPreviewState {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const urlRef = useRef<string | null>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  const signature = useMemo(() => (invoice && theme ? JSON.stringify([invoice, theme]) : ''), [invoice, theme]);

  useEffect(() => {
    if (!enabled || !invoice || !theme) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('rendering');
    setError(null);
    const timer = setTimeout(() => {
      renderRef
        .current({ invoice, theme })
        .then((blob) => {
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = next;
          setUrl(next);
          setStatus('ready');
        })
        .catch((failure: unknown) => {
          if (cancelled) return;
          console.error('Could not build the invoice PDF', failure);
          setError(describeError(failure));
          setStatus('error');
        });
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `signature` stands for the invoice and theme contents, so typing triggers one render per pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, delayMs, attempt]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    [],
  );

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { status, url, error, retry };
}
