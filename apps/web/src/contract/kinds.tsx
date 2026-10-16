'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CONTRACT_KINDS, KIND_LABELS, type ContractKind } from '@solokit/tool-contract';
import styles from './kinds.module.css';

const GLYPH: Record<ContractKind, string> = { 'nda-mutual': 'NDA ⇄', 'nda-one-way': 'NDA →', services: 'SVC' };

/** One line on what each kind is for. */
export const KIND_USE: Record<ContractKind, string> = {
  'nda-mutual': 'Both sides share confidential information, for example when you and a client explore a project together',
  'nda-one-way': 'Only one side shares secrets: you either disclose (showing a client your plans) or receive (a client briefing you before you quote). You choose which side you are',
  services: 'Scope, deliverables, fees, ownership and ending the work for a freelance project',
};

export const KIND_ORDER: readonly ContractKind[] = CONTRACT_KINDS;

/** A coloured code and the name of an agreement kind. The same colours mark the kind everywhere. */
export function KindBadge({ kind, large = false }: { kind: ContractKind; large?: boolean }) {
  return (
    <span className={`${styles.scope} ${styles.badge} ${large ? styles.large : ''}`} data-kind={kind}>
      <span className={styles.glyph} aria-hidden="true">
        {GLYPH[kind]}
      </span>
      <span className={styles.name}>{KIND_LABELS[kind]}</span>
    </span>
  );
}

export const kindClasses = { scope: styles.scope, banner: styles.banner, bannerText: styles.bannerText } as const;

export function KindBanner({ kind, children }: { kind: ContractKind; children?: ReactNode }) {
  return (
    <section className={`${styles.scope} ${styles.banner}`} data-kind={kind} aria-label="Agreement kind">
      <KindBadge kind={kind} large />
      <p className={styles.bannerText}>{KIND_USE[kind]}</p>
      {children}
    </section>
  );
}

export interface KindCardsProps {
  onPick: (kind: ContractKind) => void;
  label?: string;
  /** Moves focus into the cards when they appear. */
  autoFocus?: boolean;
}

/** Three cards, one per agreement kind, each a button with a short use-case line. Arrow keys move between them. */
export function KindCards({ onPick, label = 'Choose an agreement type', autoFocus = false }: KindCardsProps) {
  const group = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) group.current?.querySelector<HTMLElement>('button')?.focus();
    // Only when the cards appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(group.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    event.preventDefault();
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (forward ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return (
    <div className={styles.cards} role="group" aria-label={label} ref={group} onKeyDown={onKeyDown}>
      {KIND_ORDER.map((kind) => (
        <button
          key={kind}
          type="button"
          className={`${styles.scope} ${styles.card}`}
          data-kind={kind}
          aria-labelledby={`agreement-kind-name-${kind}`}
          aria-describedby={`agreement-kind-use-${kind}`}
          onClick={() => onPick(kind)}
        >
          <span className={styles.tile} aria-hidden="true">
            {GLYPH[kind]}
          </span>
          <span className={styles.cardTitle} id={`agreement-kind-name-${kind}`}>
            {KIND_LABELS[kind]}
          </span>
          <span className={styles.cardUse} id={`agreement-kind-use-${kind}`}>
            {KIND_USE[kind]}
          </span>
        </button>
      ))}
    </div>
  );
}
