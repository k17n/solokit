'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_THEME_ID, FONT_OPTIONS, PRESET_THEMES, createCustomTheme, isPresetThemeId, validateTheme, type FontId, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { type BusinessProfile } from '@solokit/profile';
import { Badge, Button, Notice, SelectField, TextField } from '@solokit/ui';
import { BrandThemeCard } from '../business/BrandThemeCard';
import { todayIso } from './editorModel';
import { newId } from './ids';
import { PdfPreview } from './PdfPreview';
import { normaliseHex, sampleInvoice, uniqueThemeName } from './themeEditing';
import { defaultPdfRenderer, usePdfPreview, type PdfRenderer } from './usePdfPreview';
import styles from './ThemesScreen.module.css';

export interface ThemesScreenProps {
  storage: InvoiceStorage;
  profile: BusinessProfile;
  /** Called when the brand theme changed the profile (it links to the theme), so the app keeps its copy current. */
  onProfileChanged?: (profile: BusinessProfile) => void;
  renderPdf?: PdfRenderer;
  now?: () => Date;
}

interface Form {
  name: string;
  accent: string;
  text: string;
  background: string;
  fontId: FontId;
}

type ColourKey = 'accent' | 'text' | 'background';
const COLOURS: { key: ColourKey; label: string }[] = [
  { key: 'accent', label: 'Accent colour' },
  { key: 'text', label: 'Text colour' },
  { key: 'background', label: 'Background colour' },
];
const GROUP_LABEL = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' } as const;
const FONT_CHOICES = FONT_OPTIONS.map((font) => ({ value: font.id, label: font.label, group: GROUP_LABEL[font.group] }));
const realNow = () => new Date();

function toForm(theme: InvoiceTheme, name: string): Form {
  return { name, accent: theme.accent, text: theme.text, background: theme.background, fontId: theme.fontId };
}

export function ThemesScreen({ storage, profile, onProfileChanged, renderPdf = defaultPdfRenderer, now = realNow }: ThemesScreenProps) {
  const [custom, setCustom] = useState<InvoiceTheme[] | null>(null);
  /** Issued or cancelled invoices from before invoices kept their own theme copy, by the theme they use. */
  const [exposed, setExposed] = useState<Record<string, number>>({});
  const [defaultId, setDefaultId] = useState(DEFAULT_THEME_ID);
  const [selectedId, setSelectedId] = useState(DEFAULT_THEME_ID);
  const [form, setForm] = useState<Form>(() => toForm(PRESET_THEMES[0] as InvoiceTheme, ''));
  const [problem, setProblem] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfter = useRef<'delete-button' | 'list' | null>(null);

  const all = useMemo(() => [...PRESET_THEMES, ...(custom ?? [])], [custom]);
  const selected = all.find((theme) => theme.id === selectedId) ?? (PRESET_THEMES[0] as InvoiceTheme);
  const isMine = !isPresetThemeId(selected.id);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    Promise.all([storage.themes.list(), storage.settings.get(), storage.invoices.list()]).then(
      ([themes, settings, invoices]) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const invoice of invoices) {
          if (invoice.status !== 'draft' && !invoice.themeSnapshot) counts[invoice.themeId] = (counts[invoice.themeId] ?? 0) + 1;
        }
        setExposed(counts);
        const ids = new Set([...PRESET_THEMES, ...themes].map((theme) => theme.id));
        const start = ids.has(settings.defaultThemeId) ? settings.defaultThemeId : DEFAULT_THEME_ID;
        const startTheme = [...PRESET_THEMES, ...themes].find((theme) => theme.id === start) as InvoiceTheme;
        setCustom(themes);
        setDefaultId(start);
        setSelectedId(start);
        setForm(toForm(startTheme, isPresetThemeId(start) ? uniqueThemeName(`${startTheme.name} custom`, [...PRESET_THEMES, ...themes].map((t) => t.name)) : startTheme.name));
      },
      (error: unknown) => {
        console.error('Could not read the themes', error);
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storage, attempt]);

  useEffect(() => {
    if (confirmDelete) confirmRef.current?.focus();
    else if (focusAfter.current === 'delete-button') deleteButtonRef.current?.focus();
    if (!confirmDelete && focusAfter.current === 'delete-button') focusAfter.current = null;
  }, [confirmDelete]);

  useEffect(() => {
    if (focusAfter.current === 'list') {
      focusAfter.current = null;
      listRef.current?.querySelector<HTMLElement>('button[aria-current="true"]')?.focus();
    }
  });

  const parsed = {
    accent: normaliseHex(form.accent),
    text: normaliseHex(form.text),
    background: normaliseHex(form.background),
  };
  const colourErrors: Partial<Record<ColourKey, string>> = {};
  for (const { key } of COLOURS) if (parsed[key] === null) colourErrors[key] = 'Use a colour like #0B1B3A';

  /** What the preview shows: the last readable value of any colour that is mid-edit. */
  const working: InvoiceTheme = useMemo(
    () => ({
      ...selected,
      name: form.name,
      accent: parsed.accent ?? selected.accent,
      text: parsed.text ?? selected.text,
      background: parsed.background ?? selected.background,
      fontId: form.fontId,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, form.name, form.fontId, parsed.accent, parsed.text, parsed.background],
  );
  const affected = isMine ? (exposed[selected.id] ?? 0) : 0;
  const warnings = Object.keys(colourErrors).length === 0 ? validateTheme(working) : [];

  const sample = useMemo(() => sampleInvoice(profile, working.id, todayIso(now())), [profile, working.id, now]);
  const preview = usePdfPreview({ invoice: custom === null ? null : sample, theme: custom === null ? null : working, enabled: custom !== null, render: renderPdf });

  if (loadFailed) {
    return (
      <div className={styles.screen}>
        <Notice tone="danger" title="Your themes could not be opened">
          Your browser could not read what was saved on this device.
        </Notice>
        <div>
          <Button onClick={() => setAttempt((count) => count + 1)}>Try again</Button>
        </div>
      </div>
    );
  }
  if (custom === null) return <p>Opening your themes…</p>;

  function choose(theme: InvoiceTheme) {
    setSelectedId(theme.id);
    setForm(toForm(theme, isPresetThemeId(theme.id) ? uniqueThemeName(`${theme.name} custom`, all.map((t) => t.name)) : theme.name));
    setProblem(null);
    setNameError(null);
    setSaved(null);
    setConfirmDelete(false);
  }

  function checkForm(excludeId: string | null): boolean {
    setProblem(null);
    setNameError(null);
    const name = form.name.trim();
    if (name === '') {
      setNameError('Give the theme a name.');
      return false;
    }
    if (all.some((theme) => theme.id !== excludeId && theme.name.trim().toLowerCase() === name.toLowerCase())) {
      setNameError('Another theme already has that name.');
      return false;
    }
    return Object.keys(colourErrors).length === 0;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setSaved(null);
    try {
      await action();
    } catch (error) {
      console.error('Could not change the themes', error);
      setProblem('That could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function saveNew() {
    if (!checkForm(null)) return;
    await run(async () => {
      const theme = createCustomTheme(selected, { name: form.name.trim(), accent: working.accent, text: working.text, background: working.background, fontId: form.fontId }, newId());
      await storage.themes.save(theme);
      setCustom((list) => [...(list ?? []), theme]);
      setSelectedId(theme.id);
      setForm(toForm(theme, theme.name));
      setSaved(`Saved "${theme.name}" as one of your themes.`);
    });
  }

  async function saveChanges() {
    if (!checkForm(selected.id)) return;
    await run(async () => {
      const theme = createCustomTheme(selected, { name: form.name.trim(), accent: working.accent, text: working.text, background: working.background, fontId: form.fontId }, selected.id);
      await storage.themes.save(theme);
      setCustom((list) => (list ?? []).map((entry) => (entry.id === theme.id ? theme : entry)));
      setForm(toForm(theme, theme.name));
      setSaved('Changes saved.');
    });
  }

  async function duplicate() {
    await run(async () => {
      const name = uniqueThemeName(`${selected.name} copy`, all.map((theme) => theme.name));
      const theme = createCustomTheme(selected, { name }, newId());
      await storage.themes.save(theme);
      setCustom((list) => [...(list ?? []), theme]);
      setSelectedId(theme.id);
      setForm(toForm(theme, theme.name));
      setSaved(`Made a copy called "${name}".`);
    });
  }

  async function remove() {
    await run(async () => {
      await storage.themes.remove(selected.id);
      if (defaultId === selected.id) {
        await storage.settings.update({ defaultThemeId: DEFAULT_THEME_ID });
        setDefaultId(DEFAULT_THEME_ID);
      }
      setCustom((list) => (list ?? []).filter((entry) => entry.id !== selected.id));
      setConfirmDelete(false);
      focusAfter.current = 'list';
      const next = PRESET_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) as InvoiceTheme;
      setSelectedId(next.id);
      setForm(toForm(next, uniqueThemeName(`${next.name} custom`, all.map((theme) => theme.name))));
      setSaved('Theme deleted.');
    });
  }

  async function makeDefault() {
    await run(async () => {
      await storage.settings.update({ defaultThemeId: selected.id });
      setDefaultId(selected.id);
      setSaved(`"${selected.name}" is now the theme for new invoices.`);
    });
  }

  return (
    <div className={styles.screen}>
      <div>
        <h2 style={{ fontSize: '1.8rem' }}>Themes</h2>
        <p className={styles.lede}>
          Pick a starting point, change its colours and font, and watch the sample invoice update. The six presets cannot be changed, but you can save your own version. New invoices use your default theme, and you can choose another on any invoice.
        </p>
      </div>

      <BrandThemeCard
        storage={storage}
        profile={profile}
        onThemeChanged={() => setAttempt((count) => count + 1)}
        {...(onProfileChanged ? { onChanged: onProfileChanged } : {})}
      />

      <div className={styles.layout}>
        <div className={styles.controls}>
          <ul className={styles.list} aria-label="Themes" role="list" ref={listRef}>
            {all.map((theme) => (
              <li key={theme.id}>
                <button
                  type="button"
                  className={styles.themeButton}
                  aria-current={theme.id === selected.id ? 'true' : undefined}
                  onClick={() => choose(theme)}
                >
                  <span className={styles.swatches} aria-hidden="true">
                    <span style={{ background: theme.accent }} />
                    <span style={{ background: theme.text }} />
                    <span style={{ background: theme.background }} />
                  </span>
                  <span className={styles.themeName}>{theme.name}</span>
                  <span className={styles.tags}>
                    {isPresetThemeId(theme.id) ? <Badge>Preset</Badge> : <Badge tone="success">Mine</Badge>}
                    {theme.id === defaultId ? <Badge tone="success">Default</Badge> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void (isMine ? saveChanges() : saveNew());
            }}
          >
            <h3 style={{ fontSize: '1.25rem' }}>{isMine ? 'Edit your theme' : `Start from ${selected.name}`}</h3>
            <p className={styles.hint}>
              Layout: {selected.layout.charAt(0).toUpperCase() + selected.layout.slice(1)}. The layout comes with the preset and cannot be changed.
            </p>
            <TextField
              label="Theme name"
              autoComplete="off"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              error={nameError ?? undefined}
            />
            {COLOURS.map(({ key, label }) => (
              <div key={key} className={styles.colour}>
                <TextField
                  label={label}
                  autoComplete="off"
                  spellCheck={false}
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  error={colourErrors[key]}
                />
                <input
                  type="color"
                  className={styles.picker}
                  aria-label={`${label} picker`}
                  value={(parsed[key] ?? working[key]).toLowerCase()}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value.toUpperCase() })}
                />
              </div>
            ))}
            <SelectField label="Font" options={FONT_CHOICES} value={form.fontId} onChange={(event) => setForm({ ...form, fontId: event.target.value as FontId })} />

            {warnings.length > 0 ? (
              <Notice tone="warning" title="Check the colours">
                <ul>
                  {warnings.map((issue) => (
                    <li key={issue.path}>{issue.message}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            {affected > 0 ? (
              <Notice tone="warning" title={`${affected} issued ${affected === 1 ? 'invoice uses' : 'invoices use'} this theme`}>
                {affected === 1 ? 'It was' : 'They were'} issued before SoloKit started keeping a copy of the theme on each invoice, so saving changes will change how {affected === 1 ? 'it prints' : 'they print'}, and
                deleting the theme will make {affected === 1 ? 'it' : 'them'} print in Classic.
              </Notice>
            ) : null}
            {problem ? <Notice tone="danger">{problem}</Notice> : null}
            {saved ? (
              <p role="status" className={styles.saved}>
                {saved}
              </p>
            ) : null}

            {confirmDelete ? (
              <div className={styles.confirm}>
                <p ref={confirmRef} tabIndex={-1}>
                  Delete the theme "{selected.name}"? This cannot be undone.{' '}
                  {affected > 0
                    ? `${affected} issued ${affected === 1 ? 'invoice that uses' : 'invoices that use'} it will print in the Classic theme.`
                    : 'Invoices already issued keep the theme they were issued with. Drafts that use it will switch to your default theme.'}
                </p>
                <div className={styles.actions}>
                  <Button type="button" disabled={busy} onClick={() => void remove()}>
                    Yes, delete theme
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      focusAfter.current = 'delete-button';
                      setConfirmDelete(false);
                    }}
                  >
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                {isMine ? (
                  <>
                    <Button type="submit" disabled={busy}>
                      Save changes
                    </Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void saveNew()}>
                      Save as new theme
                    </Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void duplicate()}>
                      Duplicate
                    </Button>
                  </>
                ) : (
                  <Button type="submit" disabled={busy}>
                    Save as my theme
                  </Button>
                )}
                <Button type="button" variant="secondary" disabled={busy || selected.id === defaultId} onClick={() => void makeDefault()}>
                  Set as default
                </Button>
                {isMine ? (
                  <button ref={deleteButtonRef} type="button" className={styles.danger} disabled={busy} onClick={() => setConfirmDelete(true)}>
                    Delete theme
                  </button>
                ) : null}
              </div>
            )}
          </form>
        </div>

        <section className={styles.preview} aria-labelledby="theme-preview-heading">
          <h3 id="theme-preview-heading" style={{ fontSize: '1.25rem' }}>
            Preview
          </h3>
          <PdfPreview state={preview} filename="sample-invoice.pdf" onRetry={preview.retry} placeholder="Choose a theme to see the preview." />
        </section>
      </div>
    </div>
  );
}
