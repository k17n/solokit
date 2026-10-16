'use client';

import { useEffect, useId, useState } from 'react';
import {
  NEUTRAL_TEXT,
  PAGE_BACKGROUND,
  brandFromSuggestion,
  contrastRatio,
  normaliseHex,
  suggestBrandFromLogo,
  type BrandSource,
  type BrandThemeSuggestion,
  type Palette,
  type PaletteDeps,
} from '@solokit/profile';
import { Button, TextField } from '@solokit/ui';
import styles from './BrandColoursField.module.css';

/** The brand colours as typed: four hex fields and where they came from. */
export interface BrandFormValue {
  primary: string;
  secondary: string;
  text: string;
  background: string;
  source: BrandSource | '';
}

export interface BrandColoursFieldProps {
  /** The logo, as a data URL. Empty when there is none. */
  logoDataUrl: string;
  value: BrandFormValue;
  onChange: (value: BrandFormValue) => void;
  /** Problems by path, for example `brand.primary`. */
  errors?: Record<string, string>;
  /** How the logo's pixels are read. Tests pass fakes; `null` means no canvas is available. The default is the browser's. */
  deps?: PaletteDeps | null;
}

type Analysis = { state: 'none' } | { state: 'reading' } | { state: 'failed' } | { state: 'ready'; palette: Palette; suggestion: BrandThemeSuggestion };

type ColourKey = 'primary' | 'secondary' | 'text' | 'background';

const ROWS: { key: ColourKey; label: string; hint?: string }[] = [
  { key: 'primary', label: 'Accent colour', hint: 'Your main brand colour. Used for headings and bands on your documents.' },
  { key: 'secondary', label: 'Second colour', hint: 'Optional.' },
  { key: 'text', label: 'Text colour' },
  { key: 'background', label: 'Background colour' },
];

export const NO_BRAND: BrandFormValue = { primary: '', secondary: '', text: '', background: '', source: '' };

const sameColour = (a: string, b: string | undefined) => (normaliseHex(a) ?? a.trim().toUpperCase()) === (b ?? '').toUpperCase();

function fromSuggestion(suggestion: BrandThemeSuggestion): BrandFormValue {
  const brand = brandFromSuggestion(suggestion);
  return { primary: brand.primary ?? '', secondary: brand.secondary ?? '', text: brand.text ?? '', background: brand.background ?? '', source: 'logo' };
}

export interface ContrastCheck {
  id: string;
  label: string;
  ratio: number;
  needed: number;
  pass: boolean;
}

/** The three readability checks a theme made from these colours has to pass. Null while the accent is not a colour yet. */
export function contrastChecks(value: Pick<BrandFormValue, 'primary' | 'text' | 'background'>): ContrastCheck[] | null {
  const accent = normaliseHex(value.primary);
  if (!accent) return null;
  const text = normaliseHex(value.text) ?? NEUTRAL_TEXT;
  const background = normaliseHex(value.background) ?? PAGE_BACKGROUND;
  const check = (id: string, label: string, ratio: number, needed: number): ContrastCheck => ({ id, label, ratio, needed, pass: ratio >= needed });
  return [
    check('text', 'Text on background', contrastRatio(text, background), 4.5),
    check('accent', 'Accent on background', contrastRatio(accent, background), 3),
    check('white', 'White text on accent', contrastRatio('#FFFFFF', accent), 4.5),
  ];
}

export function BrandColoursField({ logoDataUrl, value, onChange, errors = {}, deps }: BrandColoursFieldProps) {
  const headingId = useId();
  const [analysis, setAnalysis] = useState<Analysis>({ state: 'none' });

  useEffect(() => {
    if (!logoDataUrl) {
      setAnalysis({ state: 'none' });
      return;
    }
    let cancelled = false;
    setAnalysis({ state: 'reading' });
    suggestBrandFromLogo(logoDataUrl, deps).then(
      (result) => {
        if (!cancelled) setAnalysis(result ? { state: 'ready', palette: result.palette, suggestion: result.suggestion } : { state: 'failed' });
      },
      () => {
        if (!cancelled) setAnalysis({ state: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [logoDataUrl, deps]);

  const suggested = analysis.state === 'ready' ? fromSuggestion(analysis.suggestion) : null;
  const matchesSuggestion =
    suggested !== null &&
    value.source === 'logo' &&
    sameColour(value.primary, suggested.primary) &&
    sameColour(value.secondary, suggested.secondary) &&
    sameColour(value.text, suggested.text) &&
    sameColour(value.background, suggested.background);
  const hasColours = ROWS.some(({ key }) => value[key].trim() !== '');
  const checks = contrastChecks(value);
  const set = (key: ColourKey, text: string) => onChange({ ...value, [key]: text, source: 'manual' });

  return (
    <section className={styles.brand} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        Brand colours
      </h3>
      <p className={styles.hint}>Your documents can print in your brand colours. SoloKit can suggest them from your logo, and you can change any of them.</p>

      {logoDataUrl ? (
        <div className={styles.found}>
          {analysis.state === 'reading' ? <p role="status">Reading the colours in your logo…</p> : null}
          {analysis.state === 'failed' ? (
            <p role="status">The colours in this logo could not be read here. You can still type your brand colours below.</p>
          ) : null}
          {analysis.state === 'ready' ? (
            <>
              <p className={styles.sub} id={`${headingId}-found`}>
                Colours found in your logo
              </p>
              {analysis.palette.colours.length === 0 ? (
                <p>The logo has no solid colour to pick from.</p>
              ) : (
                <ul className={styles.palette} aria-labelledby={`${headingId}-found`}>
                  {analysis.palette.colours.map((colour) => (
                    <li key={colour.hex}>
                      <span className={styles.chip} style={{ background: colour.hex }} aria-hidden="true" />
                      <span className={styles.hex}>{colour.hex}</span>
                      <span className={styles.share}>{Math.max(1, Math.round(colour.share * 100))}% of the logo</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.sub}>
                Suggested brand colours: accent <span className={styles.hex}>{suggested?.primary}</span>
                {suggested?.secondary ? (
                  <>
                    , second colour <span className={styles.hex}>{suggested.secondary}</span>
                  </>
                ) : null}
                , text <span className={styles.hex}>{suggested?.text}</span>, background <span className={styles.hex}>{suggested?.background}</span>.
                {analysis.suggestion.source === 'fallback' ? ' The logo has no strong colour, so this is a neutral navy.' : ' Dark enough to read on white.'}
              </p>
            </>
          ) : null}
          <div className={styles.actions}>
            <Button variant="secondary" disabled={suggested === null} onClick={() => suggested && onChange(suggested)}>
              Use my logo colours
            </Button>
            {suggested && !matchesSuggestion && value.source === 'manual' && hasColours ? (
              <Button variant="ghost" onClick={() => onChange(suggested)}>
                Reset to suggestion
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className={styles.hint}>Add a logo above to get suggested colours, or type your own.</p>
      )}

      <div className={styles.rows}>
        {ROWS.map(({ key, label, hint }) => {
          const parsed = normaliseHex(value[key]);
          return (
            <div key={key} className={styles.row}>
              <TextField
                label={label}
                hint={hint}
                autoComplete="off"
                spellCheck={false}
                placeholder="#0B1B3A"
                value={value[key]}
                onChange={(event) => set(key, event.target.value)}
                error={errors[`brand.${key}`] ?? (value[key].trim() !== '' && !parsed ? 'Use a colour like #0B1B3A' : undefined)}
              />
              <input
                type="color"
                className={styles.picker}
                aria-label={`${label} picker`}
                value={(parsed ?? (key === 'text' ? NEUTRAL_TEXT : key === 'background' ? PAGE_BACKGROUND : '#0B1B3A')).toLowerCase()}
                onChange={(event) => set(key, event.target.value.toUpperCase())}
              />
            </div>
          );
        })}
      </div>

      {hasColours ? (
        <p className={styles.source}>
          {value.source === 'logo' ? 'These colours came from your logo.' : 'These colours were set by hand.'}
          {value.source === 'manual' && hasColours ? (
            <>
              {' '}
              <button type="button" className={styles.link} onClick={() => onChange({ ...NO_BRAND })}>
                Clear brand colours
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {checks ? (
        <div className={styles.checks}>
          <p className={styles.sub} id={`${headingId}-checks`}>
            Readability checks
          </p>
          <ul aria-labelledby={`${headingId}-checks`}>
            {checks.map((check) => (
              <li key={check.id} data-pass={check.pass}>
                <span className={styles.verdict}>{check.pass ? 'Passes' : 'Fails'}</span> {check.label}: {check.ratio.toFixed(1)} to 1 (needs {check.needed} or more)
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
