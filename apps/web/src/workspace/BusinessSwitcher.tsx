'use client';

import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { BUSINESS_PATH } from '../paths';
import { useWorkspaces } from './WorkspaceProvider';
import { useGuardedSwitch } from './useGuardedSwitch';
import styles from './BusinessSwitcher.module.css';

/**
 * The current Business in the site header, with a menu to switch, add or manage them. A disclosure of plain buttons
 * (the current one has `aria-current`), not an ARIA menu, so it behaves like the rest of the site's controls: Tab moves
 * through it, the arrow keys are a shortcut, Escape closes it and gives focus back to the button. A polite live region
 * says "Now working in <name>" whenever the current Business changes, however that came about.
 */
export function BusinessSwitcher() {
  const { ready, workspaces, current } = useWorkspaces();
  const switchTo = useGuardedSwitch();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const seen = useRef<string | null>(null);
  const panelId = useId();

  // Said once per change; the first Business seen on load is not news.
  useEffect(() => {
    if (!current) return;
    if (seen.current !== null && seen.current !== current.id) setAnnouncement(`Now working in ${current.name}`);
    seen.current = current.id;
  }, [current]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setProblem(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('[aria-current="true"]') ?? panel?.querySelector<HTMLElement>('button, a'))?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) close(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const active = workspaces.filter((workspace) => workspace.archivedAt === undefined);

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
      return;
    }
    if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button, a') ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  function onBlur(event: FocusEvent) {
    // Tabbing out of the menu closes it, without stealing focus back.
    if (open && event.relatedTarget && !wrapRef.current?.contains(event.relatedTarget as Node)) close(false);
  }

  async function choose(id: string) {
    if (current && id === current.id) {
      close(true);
      return;
    }
    setProblem(null);
    try {
      // False: there was unsaved work and the person chose to stay where they are.
      await switchTo(id);
      close(true);
    } catch (error) {
      console.error('Could not switch business', error);
      setProblem('That business could not be opened. Try again.');
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {ready && current ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className={styles.trigger}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => (open ? close(false) : setOpen(true))}
          >
            <span className={styles.caption}>Business</span>
            <span className={styles.name}>{current.name}</span>
            <svg className={styles.chevron} viewBox="0 0 12 8" width="12" height="8" aria-hidden="true" focusable="false">
              <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open ? (
            <div id={panelId} ref={panelRef} className={styles.panel} role="group" aria-label="Businesses">
              <ul className={styles.list}>
                {active.map((workspace) => (
                  <li key={workspace.id}>
                    <button type="button" className={styles.item} aria-current={workspace.id === current.id ? 'true' : undefined} onClick={() => void choose(workspace.id)}>
                      <span className={styles.itemName}>{workspace.name}</span>
                      {workspace.id === current.id ? <span className={styles.here}>Current</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
              {problem ? (
                <p className={styles.problem} role="alert">
                  {problem}
                </p>
              ) : null}
              <div className={styles.links}>
                <a href={`${BUSINESS_PATH}#add`}>+ Add a business</a>
                <a href={`${BUSINESS_PATH}#businesses`}>Manage businesses</a>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
