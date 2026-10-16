'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Contract } from '@solokit/tool-contract';
import type { InvoiceTheme } from '@solokit/tool-invoice';
import { defaultExporter, describeExportError, type ContractExporter } from './exporters';

export type PreviewStatus = 'idle' | 'rendering' | 'ready' | 'error';

export interface ContractPreviewState {
  status: PreviewStatus;
  /** The most recent successfully built PDF. Kept while a newer one is being built. */
  url: string | null;
  error: string | null;
  retry: () => void;
}

export interface UseContractPreviewInput {
  /** Null while the agreement is incomplete: there is nothing to preview yet. */
  contract: Contract | null;
  theme: InvoiceTheme | null;
  enabled: boolean;
  delayMs?: number;
  exporter?: ContractExporter;
}

/** Builds the agreement PDF a moment after the last change and keeps one blob address alive at a time. */
export function useContractPreview({ contract, theme, enabled, delayMs = 500, exporter = defaultExporter }: UseContractPreviewInput): ContractPreviewState {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const urlRef = useRef<string | null>(null);
  const exporterRef = useRef(exporter);
  exporterRef.current = exporter;

  // The agreement's own `updatedAt` and `version` do not change what is printed, so they stay out of the signature.
  const signature = useMemo(() => {
    if (!contract || !theme) return '';
    const { updatedAt: _updated, version: _version, ...printed } = contract;
    return JSON.stringify([printed, theme]);
  }, [contract, theme]);

  useEffect(() => {
    if (!enabled || !contract || !theme) {
      // Nothing to show: drop the last PDF so a stale one is never displayed.
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setUrl(null);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('rendering');
    setError(null);
    const timer = setTimeout(() => {
      exporterRef
        .current('pdf', { contract, theme })
        .then(({ blob }) => {
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = next;
          setUrl(next);
          setStatus('ready');
        })
        .catch((failure: unknown) => {
          if (cancelled) return;
          console.error('Could not build the agreement preview', failure);
          setError(describeExportError(failure));
          setStatus('error');
        });
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `signature` stands for the agreement and theme contents, so typing triggers one render per pause.
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
