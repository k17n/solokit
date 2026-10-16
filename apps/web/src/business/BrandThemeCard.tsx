'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import type { BrandColours, BusinessProfile } from '@solokit/profile';
import type { InvoiceStorage, InvoiceTheme } from '@solokit/tool-invoice';
import { Badge, Button, CheckboxField, Notice } from '@solokit/ui';
import { BrandThemeError, applyBrandTheme, brandThemeColours, brandThemeState } from './brandTheme';
import styles from './BrandThemeCard.module.css';

export interface BrandThemeCardProps {
  storage: InvoiceStorage;
  /** The saved profile. The theme is made from its brand colours. */
  profile: BusinessProfile;
  /** The brand colours as they are in a form right now. When they differ from the saved ones, the card asks to save first. */
  draftBrand?: BrandColours | undefined;
  /** Called with the profile after it was changed (it now links to the theme), so the screen can keep its copy. */
  onChanged?: (profile: BusinessProfile) => void;
  /** Called after a theme was created or updated, so a screen that lists themes can reload them. */
  onThemeChanged?: () => void;
}

const sameBrand = (a: Pick<BusinessProfile, 'brand'>, b: Pick<BusinessProfile, 'brand'>) => {
  const left = brandThemeColours(a);
  const right = brandThemeColours(b);
  return left === right || (left !== null && right !== null && left.accent === right.accent && left.text === right.text && left.background === right.background);
};

/**
 * Turns the brand colours into an invoice theme in one click. It never overwrites a theme the person edited: it offers
 * a new one instead.
 */
export function BrandThemeCard({ storage, profile: given, draftBrand, onChanged, onThemeChanged }: BrandThemeCardProps) {
  // The card keeps its own copy so it moves on as soon as it has changed the profile, whatever the screen does with `onChanged`.
  const [profile, setProfile] = useState(given);
  useEffect(() => setProfile(given), [given]);
  const headingId = useId();
  const [themes, setThemes] = useState<InvoiceTheme[] | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [useAsDefault, setUseAsDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    const [list, settings] = await Promise.all([storage.themes.list(), storage.settings.get()]);
    setThemes(list);
    setDefaultId(settings.defaultThemeId);
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    load().catch((error: unknown) => {
      console.error('Could not read the themes', error);
      if (!cancelled) setLoadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [load, profile]);

  if (loadFailed) return null;
  if (themes === null) return null;

  const state = brandThemeState(profile, themes);
  const unsaved = draftBrand !== undefined && !sameBrand({ brand: draftBrand }, profile);
  if (state.kind === 'none' && !unsaved) return null;

  async function run(mode: 'create' | 'update') {
    setBusy(true);
    setDone(null);
    setProblems([]);
    try {
      const result = await applyBrandTheme(storage, { mode, makeDefault: mode === 'create' ? useAsDefault : false });
      await load();
      setProfile(result.profile);
      onChanged?.(result.profile);
      onThemeChanged?.();
      setDone(
        mode === 'create'
          ? `Created the theme "${result.theme.name}"${result.madeDefault ? ' and set it as the theme for new documents' : ''}.`
          : `Updated "${result.theme.name}" to your new brand colours.`,
      );
    } catch (error) {
      if (error instanceof BrandThemeError) setProblems(error.problems);
      else {
        console.error('Could not make the brand theme', error);
        setProblems(['The brand theme could not be saved. Try again.']);
      }
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(theme: InvoiceTheme) {
    setBusy(true);
    setDone(null);
    try {
      await storage.settings.update({ defaultThemeId: theme.id });
      setDefaultId(theme.id);
      setDone(`"${theme.name}" is now the theme for new documents.`);
      onThemeChanged?.();
    } catch (error) {
      console.error('Could not change the default theme', error);
      setProblems(['That could not be saved. Try again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        Brand theme
      </h3>

      {unsaved ? (
        <p className={styles.text}>Save your business details to make a theme from the brand colours you just set.</p>
      ) : state.kind === 'create' ? (
        <>
          <p className={styles.text}>
            {state.previouslyDeleted ? 'Your brand theme was deleted. ' : ''}
            Make an invoice theme from your brand colours. Invoices, quotes and agreements can then print in them.
          </p>
          <CheckboxField label="Use it for new documents" checked={useAsDefault} onChange={(event) => setUseAsDefault(event.target.checked)} />
          <div>
            <Button disabled={busy} onClick={() => void run('create')}>
              Create a Brand theme
            </Button>
          </div>
        </>
      ) : state.kind === 'current' ? (
        <>
          <p className={styles.text}>
            <strong>{state.theme.name}</strong> matches your brand colours. {defaultId === state.theme.id ? <Badge tone="success">Default</Badge> : null}
          </p>
          {defaultId !== state.theme.id ? (
            <div>
              <Button variant="secondary" disabled={busy} onClick={() => void makeDefault(state.theme)}>
                Use it for new documents
              </Button>
            </div>
          ) : null}
        </>
      ) : state.kind === 'update' ? (
        <>
          <p className={styles.text}>
            Your brand colours changed. <strong>{state.theme.name}</strong> still has the old ones. Update it to match? Invoices you already issued keep the theme they were issued with.
          </p>
          <div>
            <Button disabled={busy} onClick={() => void run('update')}>
              Update brand theme
            </Button>
          </div>
        </>
      ) : state.kind === 'edited' ? (
        <>
          <p className={styles.text}>
            Your brand colours changed, but you edited <strong>{state.theme.name}</strong> yourself, so SoloKit leaves it alone. You can make a new brand theme from the new colours.
          </p>
          <CheckboxField label="Use it for new documents" checked={useAsDefault} onChange={(event) => setUseAsDefault(event.target.checked)} />
          <div>
            <Button variant="secondary" disabled={busy} onClick={() => void run('create')}>
              Create a new Brand theme
            </Button>
          </div>
        </>
      ) : null}

      {problems.length > 0 ? (
        <Notice tone="danger" title="The brand theme was not saved">
          <ul>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {done ? (
        <p role="status" className={styles.done}>
          {done}
        </p>
      ) : null}
    </section>
  );
}
