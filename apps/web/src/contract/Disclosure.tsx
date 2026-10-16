'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  /** Opens the section when it becomes true (for example when a field inside gets an error). It never closes it again. */
  openWhen?: boolean | undefined;
  /** Whether the section starts open. Only read when it first appears. */
  defaultOpen?: boolean | undefined;
}

/**
 * A details/summary section that stays as the reader left it. A bare `open` attribute that React sets from the data
 * snaps a section shut as soon as the data stops asking for it to be open (for example once a typo is fixed), so the
 * state is kept here and updated by the browser's own toggle event.
 */
export function Disclosure({ summary, children, className, openWhen = false, defaultOpen = false }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen || openWhen);

  useEffect(() => {
    if (openWhen) setOpen(true);
  }, [openWhen]);

  return (
    <details className={className} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
