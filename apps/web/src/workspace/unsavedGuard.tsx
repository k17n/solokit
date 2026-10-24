'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@solokit/ui';
import styles from './unsavedGuard.module.css';

/** What an editor tells the guard: whether it holds changes that are not saved, and how to save them as a draft. */
interface GuardEntry {
  dirty: boolean;
  /** Saves the work as a draft. Resolves false when it could not be saved. Without it the only choices are to switch without saving or to stay. */
  save?: (() => Promise<boolean>) | undefined;
}

/** What is about to replace the screen, for the prompt's wording: switching to another Business, or going to another page. */
export type LeaveAction = 'switch' | 'leave';

interface GuardApi {
  register(id: string, read: () => GuardEntry): () => void;
  confirmLeave(action?: LeaveAction): Promise<boolean>;
}

const WORDS: Record<LeaveAction, { title: string; save: string; go: string; failed: string }> = {
  switch: {
    title: 'Switch anyway?',
    save: 'Save draft and switch',
    go: 'Switch without saving',
    failed: 'The draft could not be saved, so nothing was switched. Try again, or switch without saving.',
  },
  leave: {
    title: 'Leave this page?',
    save: 'Save draft and leave',
    go: 'Leave without saving',
    failed: 'The draft could not be saved, so you are still here. Try again, or leave without saving.',
  },
};

const GuardContext = createContext<GuardApi | null>(null);

interface Prompt {
  resolve: (proceed: boolean) => void;
  canSave: boolean;
  action: LeaveAction;
}

/**
 * A small registry of editors that hold unsaved work. Anything that is about to replace the screen (switching to another
 * Business) asks {@link useConfirmLeave} first; if an editor registered with {@link useUnsavedGuard} is dirty, the person
 * is asked what to do with the changes.
 */
export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, () => GuardEntry>());
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const promptRef = useRef<Prompt | null>(null);
  promptRef.current = prompt;

  const api = useMemo<GuardApi>(
    () => ({
      register(id, read) {
        entries.current.set(id, read);
        return () => {
          if (entries.current.get(id) === read) entries.current.delete(id);
        };
      },
      confirmLeave(action = 'switch') {
        const dirty = [...entries.current.values()].map((read) => read()).filter((entry) => entry.dirty);
        if (dirty.length === 0) return Promise.resolve(true);
        // A second request replaces a prompt that is still open: the first one stays where it is.
        promptRef.current?.resolve(false);
        return new Promise<boolean>((resolve) => setPrompt({ resolve, canSave: dirty.every((entry) => entry.save !== undefined), action }));
      },
    }),
    [],
  );

  const answer = useCallback((proceed: boolean) => {
    const current = promptRef.current;
    setPrompt(null);
    current?.resolve(proceed);
  }, []);

  const saveAll = useCallback(async (): Promise<boolean> => {
    const dirty = [...entries.current.values()].map((read) => read()).filter((entry) => entry.dirty);
    for (const entry of dirty) {
      if (!entry.save || !(await entry.save())) return false;
    }
    return true;
  }, []);

  // Closing the page's tool (leaving the page) while a prompt is open must not leave a promise hanging.
  useEffect(() => () => promptRef.current?.resolve(false), []);

  return (
    <GuardContext.Provider value={api}>
      {children}
      {prompt ? <UnsavedPrompt canSave={prompt.canSave} action={prompt.action} onAnswer={answer} onSave={saveAll} /> : null}
    </GuardContext.Provider>
  );
}

function UnsavedPrompt({ canSave, action, onAnswer, onSave }: { canSave: boolean; action: LeaveAction; onAnswer: (proceed: boolean) => void; onSave: () => Promise<boolean> }) {
  const words = WORDS[action];
  const titleId = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    textRef.current?.focus();
    return () => before?.focus?.();
  }, []);

  async function saveAndSwitch() {
    setSaving(true);
    setFailed(false);
    try {
      if (await onSave()) onAnswer(true);
      else setFailed(true);
    } catch (error) {
      console.error('Could not save the draft before switching', error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onAnswer(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(boxRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === textRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.backdrop}>
      <div ref={boxRef} className={styles.box} role="alertdialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <h2 id={titleId} className={styles.title}>
          {words.title}
        </h2>
        <p ref={textRef} tabIndex={-1} className={styles.text}>
          Unsaved changes will be lost.
        </p>
        {failed ? (
          <p role="alert" className={styles.problem}>
            {words.failed}
          </p>
        ) : null}
        <div className={styles.actions}>
          {canSave ? (
            <Button disabled={saving} onClick={() => void saveAndSwitch()}>
              {words.save}
            </Button>
          ) : null}
          <Button variant="secondary" disabled={saving} onClick={() => onAnswer(true)}>
            {words.go}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => onAnswer(false)}>
            Stay
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Registers an editor with the guard while it is mounted. `dirty` says whether it holds unsaved work and `save` saves
 * that work as a draft (true when it worked). Outside a guard provider this does nothing.
 */
export function useUnsavedGuard(id: string, dirty: boolean, save?: () => Promise<boolean>): void {
  const api = useContext(GuardContext);
  const latest = useRef<GuardEntry>({ dirty, save });
  latest.current = { dirty, save };
  useEffect(() => api?.register(id, () => latest.current), [api, id]);
}

/** Resolves true when it is fine to replace what is on screen: nothing is unsaved, or the person chose to go on. */
export function useConfirmLeave(): (action?: LeaveAction) => Promise<boolean> {
  const api = useContext(GuardContext);
  return useCallback((action?: LeaveAction) => api?.confirmLeave(action) ?? Promise.resolve(true), [api]);
}
