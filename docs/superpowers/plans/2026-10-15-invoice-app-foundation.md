# Invoice App Foundation Implementation Plan (Plan 3C-1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the first real screens of the invoice tool on `/tools/invoice/`: shared form components, the storage hooks, a first-run onboarding that asks how the seller is registered for GST, the seller profile form (with logo upload), and the first end-to-end tests that drive a real browser.

**Architecture:** Reusable form components live in `packages/ui`. The invoice tool is a client-only React app in `apps/web/src/invoice/`, loaded with `next/dynamic` (so the home page stays light) inside the existing `StoreProvider`. All logic that is not rendering (form state, mapping to `SellerProfile`, validation messages, logo sizing) sits in small pure modules with their own tests. The tool page renders the app whenever a component is registered for the slug in `apps/web/src/tools.tsx`; flipping the registry status to "available" is done at the end of Plan 3C-2, when invoices can actually be created. End-to-end tests use Playwright with the Chrome already installed on the machine (`channel: 'chrome'`, no browser download).

**Tech Stack:** React 19, Next.js 16 static export, CSS Modules, Vitest + Testing Library, `@playwright/test`.

## Plan roadmap

1. Plan 3A (merged) invoice domain; Plan 3B (merged) PDF engine.
2. **Plan 3C-1 (this plan):** foundation, onboarding, profile, logo.
3. Plan 3C-2: invoice editor, live PDF preview, issue and download, invoice list, registry flip.
4. Plan 3C-3: theme picker and editor, backup and restore, polish, offline end-to-end.

## Global Constraints

- Local-first: nothing is sent anywhere; data goes through `DataStore` (IndexedDB, with the in-memory fallback). Ask the browser for persistent storage once data exists (`navigator.storage.persist()`), and tell the user plainly when storage is not persistent.
- GST status is asked first: **Regular**, **Composition**, **Not registered**. Fields adapt: GSTIN only for regular and composition sellers; "Not registered under GST" note option for unregistered sellers; LUT number only for regular sellers.
- Identifiers are normalised before saving (`normaliseSeller`: trim; upper-case GSTIN, PAN, UDYAM, IFSC; lower-case email) and validated with `validateSeller`. The state auto-fills from a valid GSTIN.
- Tax facts shown to users (thresholds) come from `REGISTRATION_THRESHOLDS` and `IN_RULES_AS_OF` in `@solokit/tax-engines`, with "not tax advice, confirm with your chartered accountant".
- Logos are re-encoded in the browser to PNG, at most 600 px wide, so the PDF (which accepts only PNG or JPEG) can draw them. Source files above 5 MB are rejected.
- Accessibility: every control has a visible label; errors are announced (`role="alert"`) and linked with `aria-describedby`; invalid fields have `aria-invalid`; keyboard focus is visible (global focus ring); forms use `noValidate` with our own messages; the first invalid field receives focus on submit.
- Copy: plain, sentence case, active voice, no jargon; errors say what to do.
- Quality floor: responsive to 360 px, light and dark themes via the design tokens, reduced motion respected.
- Registry status for the invoice tool stays `coming-soon` until Plan 3C-2.
- Commits use the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## File Structure

```
packages/ui/src/
  tokens.css                        (modify: danger colours)
  Form.module.css                   (new)
  Field.tsx  TextField.tsx  SelectField.tsx  TextAreaField.tsx  CheckboxField.tsx
  RadioCards.tsx  Notice.tsx
  forms.test.tsx                    (tests for all of the above)
  index.ts                          (modify)
apps/web/
  package.json  next.config.ts      (modify)
  playwright.config.ts  e2e/*.spec.ts          (new)
  src/
    tools.tsx                       (slug -> tool component map)
    components/PageShell.tsx  PageShell.module.css   (modify: wide)
    store/StoreProvider.tsx  StoreProvider.test.tsx  (modify)
    invoice/
      useInvoiceStorage.ts  persist.ts  InvoiceToolLoader.tsx
      InvoiceApp.tsx  InvoiceApp.module.css  InvoiceApp.test.tsx
      profileForm.ts  profileForm.test.ts
      ProfileForm.tsx  ProfileForm.module.css  ProfileForm.test.tsx
      Onboarding.tsx  Onboarding.test.tsx
      logo.ts  logo.test.ts  LogoField.tsx  LogoField.test.tsx
  app/tools/[slug]/page.tsx         (modify)
  src/tool-page.test.tsx            (modify)
.gitignore                          (modify)
```

---

### Task 1: Form components in the design system

**Files:**
- Modify: `packages/ui/src/tokens.css`, `packages/ui/src/index.ts`
- Create: `packages/ui/src/Form.module.css`, `Field.tsx`, `TextField.tsx`, `SelectField.tsx`, `TextAreaField.tsx`, `CheckboxField.tsx`, `RadioCards.tsx`, `Notice.tsx`
- Test: `packages/ui/src/forms.test.tsx`

**Interfaces (all exported from `@solokit/ui`):**
- `Field({ label, hint?, error?, required?, children })` where `children` is `(control: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode`
- `TextField` props: all `<input>` props except `id`, plus `label`, `hint?`, `error?`, `required?` (shows a "required" marker and sets `aria-required`; it never sets the native `required` attribute)
- `SelectField` props: `<select>` props plus `label`, `hint?`, `error?`, `required?`, `options: { value: string; label: string; group?: string }[]`, `placeholder?` (an empty first option). Options with the same `group` are wrapped in one `<optgroup>`.
- `TextAreaField` props: `<textarea>` props plus `label`, `hint?`, `error?`
- `CheckboxField` props: `<input>` props (except `type`, `id`) plus `label`, `hint?`
- `RadioCards({ legend, name, value, onChange, options, error? })` with `options: { value: string; label: string; description?: string }[]`
- `Notice({ tone?: 'info' | 'warning' | 'danger'; title?: string; children })`; `danger` uses `role="alert"`, the others `role="status"`

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/forms.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckboxField } from './CheckboxField';
import { Field } from './Field';
import { Notice } from './Notice';
import { RadioCards } from './RadioCards';
import { SelectField } from './SelectField';
import { TextAreaField } from './TextAreaField';
import { TextField } from './TextField';

describe('Field', () => {
  it('connects the label, hint and error to the control', () => {
    render(
      <Field label="Name" hint="As on your PAN" error="Enter a name">
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('As on your PAN Enter a name');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
  });

  it('leaves out the invalid state and description when there is nothing to say', () => {
    render(<Field label="Name">{(control) => <input {...control} />}</Field>);
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('TextField', () => {
  it('is typed into like a normal input and marks required fields without native validation', async () => {
    const onChange = vi.fn();
    render(<TextField label="GSTIN" required value="" onChange={onChange} />);
    const input = screen.getByLabelText('GSTIN');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).not.toBeRequired();
    await userEvent.type(input, 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows its error', () => {
    render(<TextField label="PAN" value="x" onChange={() => {}} error="PAN looks like ABCDE1234F" />);
    expect(screen.getByLabelText('PAN')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('PAN looks like ABCDE1234F');
  });
});

describe('SelectField', () => {
  const options = [
    { value: 'mh', label: 'Maharashtra', group: 'West' },
    { value: 'gj', label: 'Gujarat', group: 'West' },
    { value: 'tn', label: 'Tamil Nadu', group: 'South' },
    { value: 'x', label: 'Other' },
  ];

  it('renders a placeholder, groups and ungrouped options', async () => {
    const onChange = vi.fn();
    render(<SelectField label="State" options={options} placeholder="Choose a state" value="" onChange={onChange} />);
    const select = screen.getByLabelText('State');
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a state',
      'Maharashtra',
      'Gujarat',
      'Tamil Nadu',
      'Other',
    ]);
    expect(within(select).getAllByRole('group').map((group) => group.getAttribute('label'))).toEqual(['West', 'South']);
    await userEvent.selectOptions(select, 'tn');
    expect(onChange).toHaveBeenCalled();
  });

  it('works without a placeholder', () => {
    render(<SelectField label="State" options={options.slice(0, 2)} value="gj" onChange={() => {}} />);
    expect(screen.getByLabelText('State')).toHaveValue('gj');
    expect(within(screen.getByLabelText('State')).getAllByRole('option')).toHaveLength(2);
  });
});

describe('TextAreaField', () => {
  it('has a label and takes typed text', async () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Notes" value="" onChange={onChange} hint="Printed on every invoice" />);
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Printed on every invoice');
    await userEvent.type(screen.getByLabelText('Notes'), 'x');
    expect(onChange).toHaveBeenCalled();
  });
});

describe('CheckboxField', () => {
  it('toggles and shows its hint', async () => {
    const onChange = vi.fn();
    render(<CheckboxField label="Reverse charge" hint="Tax is paid by the buyer" checked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Reverse charge' });
    expect(box).toHaveAccessibleDescription('Tax is paid by the buyer');
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('RadioCards', () => {
  const options = [
    { value: 'regular', label: 'Regular GST registration', description: 'You charge GST on invoices.' },
    { value: 'unregistered', label: 'Not registered for GST', description: 'You issue plain invoices.' },
  ];

  it('is a labelled group of radios with descriptions', () => {
    render(<RadioCards legend="How are you registered?" name="status" value="regular" onChange={() => {}} options={options} />);
    const group = screen.getByRole('group', { name: 'How are you registered?' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Regular GST registration/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Not registered for GST/ })).not.toBeChecked();
    expect(screen.getByText('You issue plain invoices.')).toBeInTheDocument();
  });

  it('reports the chosen value', async () => {
    const onChange = vi.fn();
    render(<RadioCards legend="Status" name="status" value={undefined} onChange={onChange} options={options} />);
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    expect(onChange).toHaveBeenCalledWith('unregistered');
  });

  it('shows an error for the group', () => {
    render(<RadioCards legend="Status" name="status" value={undefined} onChange={() => {}} options={options} error="Choose one" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose one');
  });
});

describe('Notice', () => {
  it('announces danger notices as alerts and others as status messages', () => {
    render(
      <>
        <Notice tone="danger" title="Could not save">Try again.</Notice>
        <Notice tone="info">Saved on this device.</Notice>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('alert')).toHaveTextContent('Try again.');
    expect(screen.getByRole('status')).toHaveTextContent('Saved on this device.');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/ui test -- forms`
Expected: FAIL (the component modules do not exist).

- [ ] **Step 3: Add danger colours to the tokens**

In `packages/ui/src/tokens.css`, add to the first `:root` block (after `--edge: var(--ink);`):
```css
  --danger: #b42318;
  --danger-bg: #fef3f2;
  --warning-bg: #fff6e0;
```
and add to the dark `@media (prefers-color-scheme: dark) { :root { ... } }` block (after `--edge: #eaf0fa;`):
```css
    --danger: #fda29b;
    --danger-bg: #3a1514;
    --warning-bg: #3a2a0c;
```

- [ ] **Step 4: Write the styles**

`packages/ui/src/Form.module.css`:
```css
.field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.label {
  font-size: 0.95rem;
  font-weight: 600;
}

.label[data-required]::after {
  content: ' *';
  color: var(--text-muted);
}

.input,
.select,
.textarea {
  width: 100%;
  min-width: 0;
  padding: 0.6rem 0.75rem;
  font: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-s);
}

.textarea {
  min-height: 5rem;
  resize: vertical;
}

.input:hover,
.select:hover,
.textarea:hover {
  border-color: var(--text-muted);
}

.input:focus-visible,
.select:focus-visible,
.textarea:focus-visible {
  border-color: var(--edge);
}

.input[aria-invalid='true'],
.select[aria-invalid='true'],
.textarea[aria-invalid='true'] {
  border-color: var(--danger);
}

.hint {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.error {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--danger);
}

.checkbox {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.6rem;
  align-items: start;
}

.checkbox input {
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.2rem;
  accent-color: var(--emerald);
}

.checkbox label {
  font-weight: 600;
}

.checkbox .hint {
  grid-column: 2;
}

.cards {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.legend {
  padding: 0;
  margin-bottom: 0.5rem;
  font-weight: 700;
}

.card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.1rem 0.75rem;
  padding: 0.85rem 1rem;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-m);
  cursor: pointer;
}

.card:has(input:checked) {
  border-color: var(--edge);
  box-shadow: 3px 3px 0 var(--edge);
}

.card input {
  grid-row: 1 / span 2;
  margin-top: 0.25rem;
  accent-color: var(--emerald);
}

.cardLabel {
  font-weight: 700;
}

.cardDescription {
  font-size: 0.92rem;
  color: var(--text-muted);
}

.notice {
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem 1rem;
  background: var(--surface-2);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-m);
}

.notice[data-tone='warning'] {
  background: var(--warning-bg);
  border-color: color-mix(in srgb, var(--amber) 70%, transparent);
}

.notice[data-tone='danger'] {
  background: var(--danger-bg);
  border-color: var(--danger);
}

.noticeTitle {
  font-weight: 700;
}
```

- [ ] **Step 5: Implement the components**

`packages/ui/src/Field.tsx`:
```tsx
import { useId, type ReactNode } from 'react';
import styles from './Form.module.css';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

export interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: (control: FieldControlProps) => ReactNode;
}

/** A label, a control, an optional hint and an optional error, wired together for assistive technology. */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  const control: FieldControlProps = {
    id,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
  };
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id} {...(required ? { 'data-required': '' } : {})}>
        {label}
      </label>
      {children(control)}
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

`packages/ui/src/TextField.tsx`:
```tsx
import type { InputHTMLAttributes } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'children' | 'required'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
}

export function TextField({ label, hint, error, required, className, ...input }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <input
          {...input}
          {...control}
          {...(required ? { 'aria-required': true as const } : {})}
          className={[styles.input, className].filter(Boolean).join(' ')}
        />
      )}
    </Field>
  );
}
```

`packages/ui/src/SelectField.tsx`:
```tsx
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children' | 'required'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  options: SelectOption[];
  placeholder?: string;
}

type Entry = { kind: 'option'; option: SelectOption } | { kind: 'group'; label: string; options: SelectOption[] };

/** Ungrouped options stay where they are; options sharing a `group` are collected into one optgroup at its first appearance. */
function renderOptions(options: SelectOption[]): ReactNode[] {
  const entries: Entry[] = [];
  const groups = new Map<string, Extract<Entry, { kind: 'group' }>>();
  for (const option of options) {
    if (option.group === undefined) {
      entries.push({ kind: 'option', option });
      continue;
    }
    let group = groups.get(option.group);
    if (!group) {
      group = { kind: 'group', label: option.group, options: [] };
      groups.set(option.group, group);
      entries.push(group);
    }
    group.options.push(option);
  }
  return entries.map((entry) =>
    entry.kind === 'option' ? (
      <option key={`o-${entry.option.value}`} value={entry.option.value}>
        {entry.option.label}
      </option>
    ) : (
      <optgroup key={`g-${entry.label}`} label={entry.label}>
        {entry.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </optgroup>
    ),
  );
}

export function SelectField({ label, hint, error, required, options, placeholder, className, ...select }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <select
          {...select}
          {...control}
          {...(required ? { 'aria-required': true as const } : {})}
          className={[styles.select, className].filter(Boolean).join(' ')}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {renderOptions(options)}
        </select>
      )}
    </Field>
  );
}
```

`packages/ui/src/TextAreaField.tsx`:
```tsx
import type { TextareaHTMLAttributes } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'children'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

export function TextAreaField({ label, hint, error, className, rows = 3, ...textarea }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => <textarea {...textarea} {...control} rows={rows} className={[styles.textarea, className].filter(Boolean).join(' ')} />}
    </Field>
  );
}
```

`packages/ui/src/CheckboxField.tsx`:
```tsx
import { useId, type InputHTMLAttributes } from 'react';
import styles from './Form.module.css';

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'children'> {
  label: string;
  hint?: string | undefined;
}

export function CheckboxField({ label, hint, ...input }: CheckboxFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.checkbox}>
      <input {...input} id={id} type="checkbox" {...(hint ? { 'aria-describedby': hintId } : {})} />
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
```

`packages/ui/src/RadioCards.tsx`:
```tsx
import styles from './Form.module.css';

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioCardsProps {
  legend: string;
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: RadioCardOption[];
  error?: string | undefined;
}

/** A group of large, described radio buttons. Uses native radios, so the keyboard works as expected. */
export function RadioCards({ legend, name, value, onChange, options, error }: RadioCardsProps) {
  return (
    <fieldset className={styles.cards}>
      <legend className={styles.legend}>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className={styles.card}>
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
          <span className={styles.cardLabel}>{option.label}</span>
          {option.description ? <span className={styles.cardDescription}>{option.description}</span> : null}
        </label>
      ))}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
```

`packages/ui/src/Notice.tsx`:
```tsx
import type { ReactNode } from 'react';
import styles from './Form.module.css';

export interface NoticeProps {
  tone?: 'info' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
}

export function Notice({ tone = 'info', title, children }: NoticeProps) {
  return (
    <div className={styles.notice} data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      {title ? <p className={styles.noticeTitle}>{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Export the components**

Append to `packages/ui/src/index.ts`:
```ts
export { CheckboxField, type CheckboxFieldProps } from './CheckboxField';
export { Field, type FieldControlProps, type FieldProps } from './Field';
export { Notice, type NoticeProps } from './Notice';
export { RadioCards, type RadioCardOption, type RadioCardsProps } from './RadioCards';
export { SelectField, type SelectFieldProps, type SelectOption } from './SelectField';
export { TextAreaField, type TextAreaFieldProps } from './TextAreaField';
export { TextField, type TextFieldProps } from './TextField';
```

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm --filter @solokit/ui test`
Expected: PASS (all ui tests, including the new form tests).
Run: `pnpm --filter @solokit/ui typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): add form components (fields, radio cards, notices)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Stage explicit paths if `.superpowers/` or other local files appear in `git status`.)

---

### Task 2: Wire the invoice tool into the web app

**Files:**
- Modify: `apps/web/package.json`, `apps/web/next.config.ts`
- Modify: `apps/web/src/store/StoreProvider.tsx`, `StoreProvider.test.tsx`
- Modify: `apps/web/src/components/PageShell.tsx`, `PageShell.module.css`
- Create: `apps/web/src/tools.tsx`, `src/invoice/useInvoiceStorage.ts`, `src/invoice/persist.ts`, `src/invoice/InvoiceToolLoader.tsx`, `src/invoice/InvoiceApp.tsx`, `src/invoice/InvoiceApp.module.css`
- Modify: `apps/web/app/tools/[slug]/page.tsx`, `apps/web/src/tool-page.test.tsx`
- Test: `apps/web/src/invoice/InvoiceApp.test.tsx`, `StoreProvider.test.tsx`, `tool-page.test.tsx`

**Interfaces:**
- Produces:
  - `StoreProvider` reads its `factory` once, on mount (an inline function can no longer cause a loop); on fallback it logs `console.warn`.
  - `useInvoiceStorage(): { storage: InvoiceStorage | null; store: DataStore | null; persistent: boolean; ready: boolean }`
  - `requestPersistentStorage(): Promise<boolean>`
  - `TOOL_COMPONENTS: Record<string, ComponentType>` in `src/tools.tsx` (key `invoice` -> `InvoiceToolLoader`)
  - `PageShell` gets a `wide?: boolean` prop (the body is not limited to 44rem)
  - `InvoiceApp` (client): waits for storage, shows the non-persistent notice when needed, asks for persistent storage once, and renders a tabbed shell. In this task the shell has two tabs, **Invoices** and **Profile**, each showing a short placeholder; later tasks replace the placeholders.

- [ ] **Step 1: Dependencies and config**

In `apps/web/package.json` `dependencies`, add (keep alphabetical):
```json
    "@solokit/tool-invoice": "workspace:*",
    "@solokit/tool-invoice-pdf": "workspace:*",
```
In `apps/web/next.config.ts` add to `transpilePackages`: `'@solokit/tool-invoice'`, `'@solokit/tool-invoice-pdf'`.
Run: `pnpm install`
Expected: exits 0.

- [ ] **Step 2: Write the failing tests**

Replace `apps/web/src/store/StoreProvider.test.tsx` with:
```tsx
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { StoreProvider, useStore } from './StoreProvider';

afterEach(() => vi.restoreAllMocks());

function Probe() {
  const { store, persistent, ready } = useStore();
  return (
    <p>
      {ready ? 'ready' : 'loading'} / {store ? 'store' : 'no store'} / {persistent ? 'persistent' : 'temporary'}
    </p>
  );
}

describe('StoreProvider', () => {
  it('is not ready before the store has been probed', () => {
    render(
      <StoreProvider factory={createMemoryStore}>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByText('loading / no store / temporary')).toBeInTheDocument();
  });

  it('provides a persistent store once it works', async () => {
    render(
      <StoreProvider factory={createMemoryStore}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / persistent')).toBeInTheDocument();
  });

  it('falls back to a temporary store, and says so in the console, when creating the store throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = () => {
      throw new Error('IndexedDB blocked');
    };
    render(
      <StoreProvider factory={broken}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to a temporary store when the first read fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = (): DataStore => ({ ...createMemoryStore(), list: () => Promise.reject(new Error('quota')) });
    render(
      <StoreProvider factory={failing}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
  });

  it('creates the store only once even when the factory is an inline function that changes on every render', async () => {
    const created = vi.fn(() => createMemoryStore());
    function Parent() {
      const [count, setCount] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setCount(count + 1)}>
            rerender {count}
          </button>
          <StoreProvider factory={() => created()}>
            <Probe />
          </StoreProvider>
        </>
      );
    }
    render(<Parent />);
    expect(await screen.findByText('ready / store / persistent')).toBeInTheDocument();
    screen.getByRole('button').click();
    await screen.findByText('rerender 1');
    expect(created).toHaveBeenCalledTimes(1);
  });
});
```

`apps/web/src/invoice/InvoiceApp.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { StoreProvider } from '../store/StoreProvider';
import { InvoiceApp } from './InvoiceApp';

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error remove the stub between tests
  delete navigator.storage;
});

function renderApp(factory = createMemoryStore) {
  return render(
    <StoreProvider factory={factory}>
      <InvoiceApp />
    </StoreProvider>,
  );
}

describe('InvoiceApp shell', () => {
  it('waits for storage, then shows the tool navigation', async () => {
    renderApp();
    expect(screen.getByText('Opening your invoices…')).toBeInTheDocument();
    const nav = await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches tabs', async () => {
    renderApp();
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    await userEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'false');
  });

  it('warns when the browser is not keeping data between visits', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderApp(() => {
      throw new Error('blocked');
    });
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Your browser is not saving data');
    expect(notice).toHaveTextContent('download a backup');
  });

  it('does not warn when storage works', async () => {
    renderApp();
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks the browser to keep the data, once', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    renderApp();
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
```

Add to `apps/web/src/tool-page.test.tsx` (new `describe`, plus the mock at the top of the file, before the existing imports of the page):
```tsx
vi.mock('./tools', () => ({
  TOOL_COMPONENTS: { invoice: () => <p>Invoice tool is here</p> },
}));
```
and
```tsx
describe('tool route with a registered tool component', () => {
  it('shows the tool instead of the coming-soon notice', async () => {
    render(await ToolPage(params('invoice')));
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice generator' })).toBeInTheDocument();
    expect(screen.getByText('Invoice tool is here')).toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  it('keeps the coming-soon notice for tools without a component', async () => {
    render(await ToolPage(params('quote')));
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
```
(`vi` must be imported from vitest in that file. Existing tests that render the `invoice` coming-soon page must be changed to use `quote`: the earlier test "shows a coming-soon page for tools that are not built yet" already uses `quote`.)

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @solokit/web test`
Expected: FAIL (missing `InvoiceApp`, `./tools`, and the inline-factory test).

- [ ] **Step 4: Implement the StoreProvider change**

Replace `apps/web/src/store/StoreProvider.tsx` with:
```tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createIndexedDbStore, createMemoryStore, type DataStore } from '@solokit/storage';

export interface StoreState {
  store: DataStore | null;
  /** False when the browser blocked IndexedDB and data will be lost on reload. Check `ready` first. */
  persistent: boolean;
  /** True once the store has been created and probed. Until then `store` is null. */
  ready: boolean;
}

const INITIAL: StoreState = { store: null, persistent: false, ready: false };
const StoreContext = createContext<StoreState>(INITIAL);

export interface StoreProviderProps {
  children: ReactNode;
  /** Read once, when the provider mounts. Later changes of this prop are ignored. */
  factory?: () => DataStore;
}

export function StoreProvider({ children, factory = createIndexedDbStore }: StoreProviderProps) {
  const [state, setState] = useState<StoreState>(INITIAL);
  const factoryRef = useRef(factory);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: StoreState;
      try {
        const store = factoryRef.current();
        await store.list('settings');
        next = { store, persistent: true, ready: true };
      } catch (error) {
        console.warn('SoloKit could not open browser storage; falling back to temporary memory.', error);
        next = { store: createMemoryStore(), persistent: false, ready: true };
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <StoreContext.Provider value={state}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  return useContext(StoreContext);
}
```

- [ ] **Step 5: Implement PageShell `wide`**

In `apps/web/src/components/PageShell.tsx` add `wide?: boolean` to `PageShellProps`, and render the body as `<div className={wide ? `${styles.body} ${styles.wide}` : styles.body}>`. In `PageShell.module.css` append:
```css
.wide {
  max-width: none;
}
```
The heading block keeps its width. Add a test to the existing PageShell/tool tests if you like; the tool page test above covers the happy path.

- [ ] **Step 6: Implement the hooks, the tool map and the shell**

`apps/web/src/invoice/persist.ts`:
```ts
/** Asks the browser not to evict this site's data under storage pressure. Never throws. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
```

`apps/web/src/invoice/useInvoiceStorage.ts`:
```ts
import { useMemo } from 'react';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import type { DataStore } from '@solokit/storage';
import { useStore } from '../store/StoreProvider';

export interface InvoiceStorageState {
  storage: InvoiceStorage | null;
  store: DataStore | null;
  persistent: boolean;
  ready: boolean;
}

export function useInvoiceStorage(): InvoiceStorageState {
  const { store, persistent, ready } = useStore();
  const storage = useMemo(() => (store ? createInvoiceStorage(store) : null), [store]);
  return { storage, store, persistent, ready };
}
```

`apps/web/src/invoice/InvoiceToolLoader.tsx`:
```tsx
'use client';

import dynamic from 'next/dynamic';
import { StoreProvider } from '../store/StoreProvider';

// The invoice tool is client-only and loaded on demand, so the home page and the other tool pages stay light.
const InvoiceApp = dynamic(() => import('./InvoiceApp').then((module) => module.InvoiceApp), {
  ssr: false,
  loading: () => <p>Opening your invoices…</p>,
});

export function InvoiceToolLoader() {
  return (
    <StoreProvider>
      <InvoiceApp />
    </StoreProvider>
  );
}
```

`apps/web/src/tools.tsx`:
```tsx
import type { ComponentType } from 'react';
import { InvoiceToolLoader } from './invoice/InvoiceToolLoader';

/** Tool pages render the component registered here for their slug. Tools without one show a coming-soon notice. */
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  invoice: InvoiceToolLoader,
};
```

`apps/web/src/invoice/InvoiceApp.module.css`:
```css
.app {
  display: grid;
  gap: 1.5rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding-bottom: 0.9rem;
  border-bottom: 1.5px solid var(--border);
}

.tab {
  padding: 0.55rem 1rem;
  font: 600 0.98rem/1 var(--ff-sans);
  color: var(--text-muted);
  background: transparent;
  border: 1.5px solid transparent;
  border-radius: var(--radius-m);
  cursor: pointer;
}

.tab:hover {
  color: var(--text);
  background: var(--surface-2);
}

.tab[aria-selected='true'] {
  color: var(--text);
  background: var(--surface);
  border-color: var(--edge);
  box-shadow: 0 2px 0 var(--edge);
}

.panel {
  min-width: 0;
}

.empty {
  padding: 2rem 1.25rem;
  text-align: center;
  color: var(--text-muted);
  border: 1.5px dashed var(--border);
  border-radius: var(--radius-m);
}
```

`apps/web/src/invoice/InvoiceApp.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Notice } from '@solokit/ui';
import { requestPersistentStorage } from './persist';
import { useInvoiceStorage } from './useInvoiceStorage';
import styles from './InvoiceApp.module.css';

type ViewName = 'list' | 'profile';

const TABS: { name: ViewName; label: string }[] = [
  { name: 'list', label: 'Invoices' },
  { name: 'profile', label: 'Profile' },
];

export function InvoiceApp() {
  const { ready, persistent } = useInvoiceStorage();
  const [view, setView] = useState<ViewName>('list');
  const asked = useRef(false);

  useEffect(() => {
    if (ready && persistent && !asked.current) {
      asked.current = true;
      void requestPersistentStorage();
    }
  }, [ready, persistent]);

  if (!ready) return <p>Opening your invoices…</p>;

  return (
    <div className={styles.app}>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window, or download a backup before you leave.
        </Notice>
      ) : null}
      <nav aria-label="Invoice tool">
        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              type="button"
              role="tab"
              aria-selected={view === tab.name}
              className={styles.tab}
              onClick={() => setView(tab.name)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div className={styles.panel}>
        {view === 'list' ? <p className={styles.empty}>Your invoices will appear here.</p> : <p className={styles.empty}>Your business profile will go here.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Update the tool page**

In `apps/web/app/tools/[slug]/page.tsx` add `import { TOOL_COMPONENTS } from '../../../src/tools';` and, right after the `notFound()` guard, before the coming-soon return:
```tsx
  const Tool = TOOL_COMPONENTS[tool.slug];
  if (Tool) {
    return (
      <PageShell eyebrow={TOOL_CATEGORY_LABELS[tool.category]} title={tool.name} lede={tool.tagline} wide>
        <Tool />
      </PageShell>
    );
  }
```

- [ ] **Step 8: Run tests, typecheck and build**

Run: `pnpm --filter @solokit/web test`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.
Run: `pnpm build`
Expected: "Compiled successfully"; `/tools/invoice` is still pre-rendered; `ls apps/web/out/_next/static/chunks | wc -l` shows chunks, and the home page HTML does not reference a react-pdf chunk (`grep -c "react-pdf" apps/web/out/index.html` prints `0`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): load the invoice tool shell on its tool page

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Profile form logic

**Files:**
- Create: `apps/web/src/invoice/profileForm.ts`
- Test: `apps/web/src/invoice/profileForm.test.ts`

**Interfaces:**
- Consumes: `normaliseSeller`, `validateSeller`, `type Issue`, `type SellerProfile` from `@solokit/tool-invoice`; `INDIAN_STATES`, `validateGstin`, `type SellerGstStatus` from `@solokit/tax-engines`.
- Produces:
  - `interface ProfileFormState` (all strings except `gstStatus`, `unregisteredNote: boolean`): `name, gstStatus, gstin, pan, udyam, line1, line2, city, postalCode, stateCode, email, phone, website, bankAccountName, bankAccountNumber, ifsc, bankName, branch, upiId, lutNumber, invoicePrefix, defaultNotes, defaultTerms, unregisteredNote, logoDataUrl`
  - `emptyProfileForm(gstStatus: SellerGstStatus): ProfileFormState` (`unregisteredNote` true)
  - `profileToForm(profile: SellerProfile): ProfileFormState`
  - `formToProfile(form: ProfileFormState): SellerProfile` (id `'me'`, country `'India'`, normalised; GSTIN only for regular and composition; LUT only for regular; `unregisteredNote` only for unregistered; bank only when any bank field is filled)
  - `validateProfileForm(form: ProfileFormState): Issue[]` (the seller rules plus: when any bank field is filled, account holder, account number, IFSC and bank name are all required)
  - `issuesByField(issues: Issue[]): Record<string, string>` (first message per path)
  - `applyGstin(form: ProfileFormState, gstin: string): ProfileFormState` (stores the typed value upper-cased and trimmed, and fills `stateCode` when the GSTIN is valid)
  - `selectableStates(): { value: string; label: string }[]` (sorted by name; excludes the legacy and non-geographic codes `25`, `28`, `99`)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/profileForm.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  applyGstin,
  emptyProfileForm,
  formToProfile,
  issuesByField,
  profileToForm,
  selectableStates,
  validateProfileForm,
  type ProfileFormState,
} from './profileForm';

const filled = (overrides: Partial<ProfileFormState> = {}): ProfileFormState => ({
  ...emptyProfileForm('regular'),
  name: '  Asha Rao Consulting ',
  gstin: '27aapfu0939f1zv',
  pan: 'aapfu0939f',
  line1: '12 Linking Road',
  city: 'Mumbai',
  postalCode: '400050',
  stateCode: '27',
  email: 'ASHA@Example.com ',
  ...overrides,
});

describe('emptyProfileForm', () => {
  it('starts blank with the chosen status and the unregistered note switched on', () => {
    const form = emptyProfileForm('unregistered');
    expect(form.gstStatus).toBe('unregistered');
    expect(form.unregisteredNote).toBe(true);
    expect(form.name).toBe('');
    expect(form.logoDataUrl).toBe('');
  });
});

describe('formToProfile', () => {
  it('normalises identifiers and builds a profile with the fixed id and country', () => {
    const profile = formToProfile(filled());
    expect(profile).toMatchObject({
      id: 'me',
      name: 'Asha Rao Consulting',
      gstStatus: 'regular',
      gstin: '27AAPFU0939F1ZV',
      pan: 'AAPFU0939F',
      email: 'asha@example.com',
      address: { line1: '12 Linking Road', city: 'Mumbai', postalCode: '400050', stateCode: '27', country: 'India' },
    });
    expect('line2' in profile.address).toBe(false);
    expect('bank' in profile).toBe(false);
    expect('lutNumber' in profile).toBe(false);
  });

  it('drops the GSTIN for an unregistered seller and keeps the note switch', () => {
    const profile = formToProfile(filled({ gstStatus: 'unregistered', unregisteredNote: false }));
    expect('gstin' in profile).toBe(false);
    expect(profile.unregisteredNote).toBe(false);
  });

  it('keeps the LUT number only for regular sellers', () => {
    expect(formToProfile(filled({ lutNumber: 'ad270326012345z' })).lutNumber).toBe('ad270326012345z');
    expect('lutNumber' in formToProfile(filled({ gstStatus: 'composition', lutNumber: 'x' }))).toBe(false);
  });

  it('builds bank details only when something was entered', () => {
    const profile = formToProfile(
      filled({ bankAccountName: 'Asha Rao', bankAccountNumber: '123456789012', ifsc: 'hdfc0001234', bankName: 'HDFC Bank', branch: ' Bandra ' }),
    );
    expect(profile.bank).toEqual({
      accountName: 'Asha Rao',
      accountNumber: '123456789012',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branch: 'Bandra',
    });
  });

  it('carries the logo, defaults and prefix through', () => {
    const profile = formToProfile(
      filled({ logoDataUrl: 'data:image/png;base64,AAAA', defaultNotes: 'Thanks', defaultTerms: 'Net 15', invoicePrefix: 'INV/', upiId: 'asha@okhdfc' }),
    );
    expect(profile).toMatchObject({
      logoDataUrl: 'data:image/png;base64,AAAA',
      defaultNotes: 'Thanks',
      defaultTerms: 'Net 15',
      invoicePrefix: 'INV/',
      upiId: 'asha@okhdfc',
    });
  });
});

describe('profileToForm', () => {
  it('round-trips a profile', () => {
    const profile = formToProfile(
      filled({ bankAccountName: 'Asha Rao', bankAccountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank', lutNumber: 'LUT1', upiId: 'asha@okhdfc' }),
    );
    expect(formToProfile(profileToForm(profile))).toEqual(profile);
  });

  it('turns missing optional values into empty strings', () => {
    const form = profileToForm(formToProfile(filled()));
    expect(form.line2).toBe('');
    expect(form.bankName).toBe('');
    expect(form.unregisteredNote).toBe(true);
  });
});

describe('validateProfileForm', () => {
  it('accepts a complete regular seller', () => {
    expect(validateProfileForm(filled())).toEqual([]);
  });

  it('accepts a minimal unregistered seller', () => {
    const form = emptyProfileForm('unregistered');
    form.name = 'Ravi';
    form.line1 = '4 Park Street';
    form.city = 'Kolkata';
    expect(validateProfileForm(form)).toEqual([]);
  });

  it('reports what is missing', () => {
    const paths = validateProfileForm(emptyProfileForm('regular')).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'address.line1', 'address.city', 'gstin']));
  });

  it('requires every bank field once one is filled', () => {
    const paths = validateProfileForm(filled({ bankName: 'HDFC Bank' })).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['bank.accountName', 'bank.accountNumber', 'bank.ifsc']));
    expect(paths).not.toContain('bank.bankName');
  });

  it('checks the format of the optional fields', () => {
    const paths = validateProfileForm(filled({ upiId: 'nope', pan: 'x', email: 'bad' })).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['upiId', 'pan', 'email']));
  });
});

describe('issuesByField', () => {
  it('keeps the first message for each field', () => {
    expect(
      issuesByField([
        { path: 'gstin', message: 'first' },
        { path: 'gstin', message: 'second' },
        { path: 'name', message: 'Enter a name' },
      ]),
    ).toEqual({ gstin: 'first', name: 'Enter a name' });
  });
});

describe('applyGstin', () => {
  it('upper-cases and trims what was typed', () => {
    expect(applyGstin(emptyProfileForm('regular'), ' 27aap ').gstin).toBe('27AAP');
  });

  it('fills the state from a valid GSTIN, and leaves it alone otherwise', () => {
    const valid = applyGstin(emptyProfileForm('regular'), '29AAGCB7383J1Z4');
    expect(valid.stateCode).toBe('29');
    const typing = applyGstin({ ...emptyProfileForm('regular'), stateCode: '07' }, '29AAGCB');
    expect(typing.stateCode).toBe('07');
  });
});

describe('selectableStates', () => {
  it('lists states by name without legacy or non-geographic codes', () => {
    const states = selectableStates();
    const labels = states.map((state) => state.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(states.find((state) => state.value === '27')?.label).toBe('Maharashtra');
    for (const code of ['25', '28', '99']) expect(states.some((state) => state.value === code)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- profileForm`
Expected: FAIL (cannot resolve `./profileForm`).

- [ ] **Step 3: Implement**

`apps/web/src/invoice/profileForm.ts`:
```ts
import { INDIAN_STATES, validateGstin, type SellerGstStatus } from '@solokit/tax-engines';
import { normaliseSeller, validateSeller, type Issue, type SellerProfile } from '@solokit/tool-invoice';

export interface ProfileFormState {
  name: string;
  gstStatus: SellerGstStatus;
  gstin: string;
  pan: string;
  udyam: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  stateCode: string;
  email: string;
  phone: string;
  website: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string;
  upiId: string;
  lutNumber: string;
  invoicePrefix: string;
  defaultNotes: string;
  defaultTerms: string;
  unregisteredNote: boolean;
  logoDataUrl: string;
}

export function emptyProfileForm(gstStatus: SellerGstStatus): ProfileFormState {
  return {
    name: '',
    gstStatus,
    gstin: '',
    pan: '',
    udyam: '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    stateCode: '',
    email: '',
    phone: '',
    website: '',
    bankAccountName: '',
    bankAccountNumber: '',
    ifsc: '',
    bankName: '',
    branch: '',
    upiId: '',
    lutNumber: '',
    invoicePrefix: '',
    defaultNotes: '',
    defaultTerms: '',
    unregisteredNote: true,
    logoDataUrl: '',
  };
}

export function profileToForm(profile: SellerProfile): ProfileFormState {
  return {
    name: profile.name,
    gstStatus: profile.gstStatus,
    gstin: profile.gstin ?? '',
    pan: profile.pan ?? '',
    udyam: profile.udyam ?? '',
    line1: profile.address.line1,
    line2: profile.address.line2 ?? '',
    city: profile.address.city,
    postalCode: profile.address.postalCode ?? '',
    stateCode: profile.address.stateCode ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    website: profile.website ?? '',
    bankAccountName: profile.bank?.accountName ?? '',
    bankAccountNumber: profile.bank?.accountNumber ?? '',
    ifsc: profile.bank?.ifsc ?? '',
    bankName: profile.bank?.bankName ?? '',
    branch: profile.bank?.branch ?? '',
    upiId: profile.upiId ?? '',
    lutNumber: profile.lutNumber ?? '',
    invoicePrefix: profile.invoicePrefix ?? '',
    defaultNotes: profile.defaultNotes ?? '',
    defaultTerms: profile.defaultTerms ?? '',
    unregisteredNote: profile.unregisteredNote !== false,
    logoDataUrl: profile.logoDataUrl ?? '',
  };
}

const BANK_FIELDS = ['bankAccountName', 'bankAccountNumber', 'ifsc', 'bankName', 'branch'] as const;

function hasBankDetails(form: ProfileFormState): boolean {
  return BANK_FIELDS.some((field) => form[field].trim() !== '');
}

/** Turns what was typed into a normalised SellerProfile. Run `validateProfileForm` first. */
export function formToProfile(form: ProfileFormState): SellerProfile {
  const taxRegistered = form.gstStatus !== 'unregistered';
  const profile: SellerProfile = {
    id: 'me',
    name: form.name,
    gstStatus: form.gstStatus,
    address: {
      line1: form.line1,
      line2: form.line2,
      city: form.city,
      postalCode: form.postalCode,
      stateCode: form.stateCode,
      country: 'India',
    },
    pan: form.pan,
    udyam: form.udyam,
    email: form.email,
    phone: form.phone,
    website: form.website,
    upiId: form.upiId,
    invoicePrefix: form.invoicePrefix,
    defaultNotes: form.defaultNotes,
    defaultTerms: form.defaultTerms,
    logoDataUrl: form.logoDataUrl,
  };
  if (taxRegistered) profile.gstin = form.gstin;
  if (form.gstStatus === 'regular') profile.lutNumber = form.lutNumber;
  if (form.gstStatus === 'unregistered') profile.unregisteredNote = form.unregisteredNote;
  if (hasBankDetails(form)) {
    profile.bank = {
      accountName: form.bankAccountName,
      accountNumber: form.bankAccountNumber,
      ifsc: form.ifsc,
      bankName: form.bankName,
      branch: form.branch,
    };
  }
  return normaliseSeller(profile);
}

export function validateProfileForm(form: ProfileFormState): Issue[] {
  const issues = validateSeller(formToProfile(form));
  const seen = new Set(issues.map((issue) => issue.path));
  if (hasBankDetails(form)) {
    const required: [string, string, string][] = [
      ['bank.accountName', form.bankAccountName, 'Enter the account holder name'],
      ['bank.accountNumber', form.bankAccountNumber, 'Enter the account number'],
      ['bank.ifsc', form.ifsc, 'Enter the IFSC code'],
      ['bank.bankName', form.bankName, 'Enter the bank name'],
    ];
    for (const [path, value, message] of required) {
      if (value.trim() === '' && !seen.has(path)) issues.push({ path, message });
    }
  }
  return issues;
}

export function issuesByField(issues: Issue[]): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const issue of issues) {
    if (!(issue.path in byField)) byField[issue.path] = issue.message;
  }
  return byField;
}

/** Stores the typed GSTIN upper-cased, and fills the state from it once it is a valid GSTIN. */
export function applyGstin(form: ProfileFormState, gstin: string): ProfileFormState {
  const cleaned = gstin.trim().toUpperCase();
  const result = validateGstin(cleaned);
  return { ...form, gstin: cleaned, stateCode: result.valid ? result.stateCode : form.stateCode };
}

const HIDDEN_STATE_CODES = new Set(['25', '28', '99']);

export function selectableStates(): { value: string; label: string }[] {
  return INDIAN_STATES.filter((state) => !HIDDEN_STATE_CODES.has(state.code))
    .map((state) => ({ value: state.code, label: state.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- profileForm`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors. If `normaliseSeller` keeps an empty `address.line2` or drops a required empty field, report exactly what it does instead of changing the tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add profile form state, mapping and validation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Logo processing and upload control

**Files:**
- Create: `apps/web/src/invoice/logo.ts`, `LogoField.tsx`
- Test: `apps/web/src/invoice/logo.test.ts`, `LogoField.test.tsx`

**Interfaces:**
- Produces:
  - `MAX_LOGO_BYTES = 5 * 1024 * 1024`, `MAX_LOGO_WIDTH = 600`, `MAX_LOGO_HEIGHT = 300`, `ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']`
  - `fitWithin(width, height, maxWidth, maxHeight): { width: number; height: number }` (keeps the aspect ratio, never enlarges, whole pixels, at least 1)
  - `class LogoError extends Error`
  - `processLogoFile(file: File, deps?: LogoDeps): Promise<string>` (a PNG data URL). `LogoDeps = { loadImage(file: File): Promise<{ width: number; height: number; source: unknown }>; createCanvas(width: number, height: number): { getContext(kind: '2d'): { drawImage(source: unknown, x: number, y: number, width: number, height: number): void } | null; toDataURL(type: string): string } }`. The default `deps` use the browser (`Image` plus an object URL, and `document.createElement('canvas')`).
  - `LogoField({ value, onChange, process? })`: a "Logo" file chooser, a preview of the current logo, a "Remove logo" button, and an error notice; `process` defaults to `processLogoFile`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/logo.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { LogoError, MAX_LOGO_BYTES, fitWithin, processLogoFile, type LogoDeps } from './logo';

function fakeDeps(image: { width: number; height: number }) {
  const drawImage = vi.fn();
  const canvases: { width: number; height: number }[] = [];
  const deps: LogoDeps = {
    loadImage: async () => ({ ...image, source: 'bitmap' }),
    createCanvas: (width, height) => {
      canvases.push({ width, height });
      return {
        getContext: () => ({ drawImage }),
        toDataURL: (type: string) => `data:${type};base64,FAKE`,
      };
    },
  };
  return { deps, drawImage, canvases };
}

const file = (type: string, size = 1000, name = 'logo') => new File([new Uint8Array(size)], name, { type });

describe('fitWithin', () => {
  it('keeps the aspect ratio inside the limits', () => {
    expect(fitWithin(1200, 600, 600, 300)).toEqual({ width: 600, height: 300 });
    expect(fitWithin(1200, 1200, 600, 300)).toEqual({ width: 300, height: 300 });
    expect(fitWithin(300, 900, 600, 300)).toEqual({ width: 100, height: 300 });
  });

  it('never enlarges', () => {
    expect(fitWithin(200, 100, 600, 300)).toEqual({ width: 200, height: 100 });
  });

  it('rounds to whole pixels and never goes below 1', () => {
    expect(fitWithin(1000, 3, 600, 300)).toEqual({ width: 600, height: 2 });
    expect(fitWithin(1, 1000, 600, 300)).toEqual({ width: 1, height: 300 });
    expect(fitWithin(10000, 1, 600, 300)).toEqual({ width: 600, height: 1 });
  });
});

describe('processLogoFile', () => {
  it('draws the image scaled down onto a canvas and returns a PNG data URL', async () => {
    const { deps, drawImage, canvases } = fakeDeps({ width: 1200, height: 600 });
    const url = await processLogoFile(file('image/jpeg'), deps);
    expect(url).toBe('data:image/png;base64,FAKE');
    expect(canvases).toEqual([{ width: 600, height: 300 }]);
    expect(drawImage).toHaveBeenCalledWith('bitmap', 0, 0, 600, 300);
  });

  it('accepts SVG, WebP and GIF as well as PNG and JPEG', async () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']) {
      const { deps } = fakeDeps({ width: 100, height: 50 });
      await expect(processLogoFile(file(type), deps)).resolves.toBe('data:image/png;base64,FAKE');
    }
  });

  it('rejects other file types with a plain message', async () => {
    const { deps } = fakeDeps({ width: 100, height: 50 });
    const error = await processLogoFile(file('application/pdf'), deps).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LogoError);
    expect((error as Error).message).toBe('Choose a PNG, JPEG, WebP, GIF or SVG image.');
  });

  it('rejects files that are too big or empty', async () => {
    const { deps } = fakeDeps({ width: 100, height: 50 });
    await expect(processLogoFile(file('image/png', MAX_LOGO_BYTES + 1), deps)).rejects.toThrow('smaller than 5 MB');
    await expect(processLogoFile(file('image/png', 0), deps)).rejects.toThrow('empty');
  });

  it('reports an image that cannot be read', async () => {
    const deps: LogoDeps = {
      loadImage: () => Promise.reject(new Error('decode failed')),
      createCanvas: () => {
        throw new Error('not reached');
      },
    };
    await expect(processLogoFile(file('image/png'), deps)).rejects.toThrow('could not be read');
  });

  it('reports a browser that cannot draw', async () => {
    const deps: LogoDeps = {
      loadImage: async () => ({ width: 10, height: 10, source: 'x' }),
      createCanvas: () => ({ getContext: () => null, toDataURL: () => '' }),
    };
    await expect(processLogoFile(file('image/png'), deps)).rejects.toThrow('could not be read');
  });

  it('rejects an image with no size', async () => {
    const { deps } = fakeDeps({ width: 0, height: 0 });
    await expect(processLogoFile(file('image/png'), deps)).rejects.toThrow('could not be read');
  });
});
```

`apps/web/src/invoice/LogoField.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LogoError } from './logo';
import { LogoField } from './LogoField';

const png = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' });

describe('LogoField', () => {
  it('has a labelled file chooser and no preview when there is no logo', () => {
    render(<LogoField value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Logo')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove logo' })).not.toBeInTheDocument();
  });

  it('processes a chosen file and reports the data URL', async () => {
    const onChange = vi.fn();
    const process = vi.fn().mockResolvedValue('data:image/png;base64,OK');
    render(<LogoField value="" onChange={onChange} process={process} />);
    await userEvent.upload(screen.getByLabelText('Logo'), png);
    expect(process).toHaveBeenCalledWith(png);
    expect(onChange).toHaveBeenCalledWith('data:image/png;base64,OK');
  });

  it('shows the current logo and lets it be removed', async () => {
    const onChange = vi.fn();
    render(<LogoField value="data:image/png;base64,AAAA" onChange={onChange} />);
    expect(screen.getByRole('img', { name: 'Your logo' })).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    await userEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the reason when a file cannot be used, and keeps the old logo', async () => {
    const onChange = vi.fn();
    const process = vi.fn().mockRejectedValue(new LogoError('Choose a PNG, JPEG, WebP, GIF or SVG image.'));
    render(<LogoField value="data:image/png;base64,OLD" onChange={onChange} process={process} />);
    await userEvent.upload(screen.getByLabelText('Logo'), png);
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a PNG, JPEG, WebP, GIF or SVG image.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a generic message for unexpected errors', async () => {
    const process = vi.fn().mockRejectedValue(new Error('boom'));
    render(<LogoField value="" onChange={() => {}} process={process} />);
    await userEvent.upload(screen.getByLabelText('Logo'), png);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be used');
  });
});
```
(`userEvent.upload` respects the input's `accept`; the file chooser must therefore list `image/png` among its accepted types.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- logo LogoField`
Expected: FAIL (missing modules).

- [ ] **Step 3: Implement the processing**

`apps/web/src/invoice/logo.ts`:
```ts
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_WIDTH = 600;
export const MAX_LOGO_HEIGHT = 300;
export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'] as const;

export class LogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogoError';
  }
}

/** Scales a size down to fit the limits, keeping the aspect ratio. Never enlarges; whole pixels, at least 1. */
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface LogoCanvas {
  getContext(kind: '2d'): { drawImage(source: unknown, x: number, y: number, width: number, height: number): void } | null;
  toDataURL(type: string): string;
}

export interface LogoDeps {
  loadImage(file: File): Promise<{ width: number; height: number; source: unknown }>;
  createCanvas(width: number, height: number): LogoCanvas;
}

const browserDeps: LogoDeps = {
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('The image could not be decoded'));
      };
      image.src = url;
    });
  },
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return {
      getContext: () => canvas.getContext('2d') as ReturnType<LogoCanvas['getContext']>,
      toDataURL: (type) => canvas.toDataURL(type),
    };
  },
};

const UNREADABLE = 'That image could not be read. Try a PNG or JPEG file.';

/**
 * Re-encodes a chosen logo as a PNG data URL no larger than 600 x 300 pixels. PDFs can draw PNG and JPEG only,
 * and keeping the logo small keeps backups and invoices small. Transparency is kept.
 */
export async function processLogoFile(file: File, deps: LogoDeps = browserDeps): Promise<string> {
  if (!(ACCEPTED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    throw new LogoError('Choose a PNG, JPEG, WebP, GIF or SVG image.');
  }
  if (file.size === 0) throw new LogoError('That file is empty.');
  if (file.size > MAX_LOGO_BYTES) throw new LogoError('Choose an image smaller than 5 MB.');

  let loaded: Awaited<ReturnType<LogoDeps['loadImage']>>;
  try {
    loaded = await deps.loadImage(file);
  } catch {
    throw new LogoError(UNREADABLE);
  }
  if (!(loaded.width > 0 && loaded.height > 0)) throw new LogoError(UNREADABLE);

  const size = fitWithin(loaded.width, loaded.height, MAX_LOGO_WIDTH, MAX_LOGO_HEIGHT);
  const canvas = deps.createCanvas(size.width, size.height);
  const context = canvas.getContext('2d');
  if (!context) throw new LogoError(UNREADABLE);
  context.drawImage(loaded.source, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/png');
}
```

- [ ] **Step 4: Implement the field**

`apps/web/src/invoice/LogoField.tsx`:
```tsx
'use client';

import { useId, useState } from 'react';
import { Button, Notice } from '@solokit/ui';
import { ACCEPTED_LOGO_TYPES, LogoError, processLogoFile } from './logo';

export interface LogoFieldProps {
  value: string;
  onChange: (dataUrl: string) => void;
  process?: (file: File) => Promise<string>;
}

export function LogoField({ value, onChange, process = processLogoFile }: LogoFieldProps) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      onChange(await process(file));
    } catch (caught) {
      setError(caught instanceof LogoError ? caught.message : 'That image could not be used. Try a PNG or JPEG file.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <label htmlFor={inputId} style={{ fontWeight: 600 }}>
        Logo
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_LOGO_TYPES.join(',')}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Optional. It is shrunk on your device and printed at the top of your invoices.
      </p>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <img
            src={value}
            alt="Your logo"
            style={{ maxWidth: '12rem', maxHeight: '5rem', objectFit: 'contain', background: 'var(--surface-2)', borderRadius: 'var(--radius-s)', padding: '0.4rem' }}
          />
          <Button variant="secondary" onClick={() => onChange('')}>
            Remove logo
          </Button>
        </div>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- logo LogoField`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add logo processing and upload control

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Profile form component and onboarding

**Files:**
- Create: `apps/web/src/invoice/ProfileForm.tsx`, `ProfileForm.module.css`, `Onboarding.tsx`
- Modify: `apps/web/src/invoice/InvoiceApp.tsx`, `InvoiceApp.test.tsx`
- Test: `apps/web/src/invoice/ProfileForm.test.tsx`, `Onboarding.test.tsx`

**Interfaces:**
- Consumes: the form components from Task 1; `profileForm.ts` from Task 3; `LogoField` from Task 4; `useInvoiceStorage`.
- Produces:
  - `ProfileForm({ initial: ProfileFormState; submitLabel: string; onSave(profile: SellerProfile): Promise<void> | void; processLogo?: (file: File) => Promise<string> })`: a `<form noValidate>`. Sections (fieldset legends): "Your business", "Address", "Contact", "Payment details", "Invoice defaults". Labels: "Business or personal name", "GSTIN" (regular and composition only), "PAN", "UDYAM number", "Address line 1", "Address line 2", "City", "PIN code", "State", "Email", "Phone", "Website", "Account holder name", "Account number", "IFSC", "Bank name", "Branch", "UPI ID", "LUT number" (regular only), "Invoice number prefix", "Default notes", "Default terms", and the checkbox "Print “Not registered under GST” on invoices" (unregistered only). The GST status radio group is titled "How are you registered for GST?". Errors appear only after the first submit attempt and update live; submit focuses the first invalid field; a save failure shows a danger notice.
  - `Onboarding({ onDone(profile) })`: step 1 shows the status cards ("Regular GST registration", "Composition scheme", "Not registered for GST"; description texts below) and a "Continue" button; step 2 shows the profile form with the label "Save and continue".
  - `InvoiceApp` now loads the profile and settings: no saved profile means onboarding is shown (no tabs); after onboarding the profile is saved, `settings.onboarded` becomes true, and the tabbed shell appears. The Profile tab shows the form with the saved profile ("Save changes") and a "Saved" status message after saving.

Status card texts (use exactly):
- `regular`: label "Regular GST registration", description "You charge GST on your invoices and file GST returns."
- `composition`: label "Composition scheme", description "You pay GST as a flat percentage of turnover and cannot charge it separately."
- `unregistered`: label "Not registered for GST", description "Your turnover is below the limit, or you only sell exempt services. You issue plain invoices without GST."

Unregistered notice (shown in the form when the status is unregistered), title "Check your turnover limit": "You can stay unregistered while your yearly turnover is below ₹20,00,000 for services or ₹40,00,000 for goods (lower in some states). Rules last checked 13 Oct 2026. This is not tax advice; confirm with your chartered accountant." (Build the amounts with `formatMoney(REGISTRATION_THRESHOLDS.services)` etc., trimming the `.00`, and the date with `formatIsoDate(IN_RULES_AS_OF)` from `@solokit/ui`.)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/ProfileForm.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileForm } from './ProfileForm';
import { emptyProfileForm } from './profileForm';

function setup(status: 'regular' | 'composition' | 'unregistered' = 'regular') {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<ProfileForm initial={emptyProfileForm(status)} submitLabel="Save and continue" onSave={onSave} />);
  return { onSave };
}

async function fillRegular() {
  await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha Rao Consulting');
  await userEvent.type(screen.getByLabelText('GSTIN'), '27aapfu0939f1zv');
  await userEvent.type(screen.getByLabelText('Address line 1'), '12 Linking Road');
  await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
}

describe('ProfileForm fields adapt to the GST status', () => {
  it('asks regular sellers for a GSTIN and an LUT number', () => {
    setup('regular');
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
    expect(screen.getByLabelText('LUT number')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Not registered under GST/ })).not.toBeInTheDocument();
  });

  it('asks composition sellers for a GSTIN but not an LUT number', () => {
    setup('composition');
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
    expect(screen.queryByLabelText('LUT number')).not.toBeInTheDocument();
  });

  it('asks unregistered sellers for neither, offers the note, and shows the turnover notice', () => {
    setup('unregistered');
    expect(screen.queryByLabelText('GSTIN')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('LUT number')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Not registered under GST/ })).toBeChecked();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Check your turnover limit');
    expect(notice).toHaveTextContent('₹20,00,000');
    expect(notice).toHaveTextContent('₹40,00,000');
    expect(notice).toHaveTextContent('13 Oct 2026');
    expect(notice).toHaveTextContent('not tax advice');
  });

  it('switches the fields when the status is changed', async () => {
    setup('regular');
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    expect(screen.queryByLabelText('GSTIN')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Regular GST registration/ }));
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
  });
});

describe('ProfileForm behaviour', () => {
  it('fills the state from a valid GSTIN', async () => {
    setup('regular');
    await userEvent.type(screen.getByLabelText('GSTIN'), '29AAGCB7383J1Z4');
    expect(screen.getByLabelText('State')).toHaveValue('29');
  });

  it('shows errors only after the first submit, then keeps them up to date', async () => {
    const { onSave } = setup('regular');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Business or personal name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('GSTIN')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(screen.getByLabelText('Business or personal name')).toHaveFocus());
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha');
    expect(screen.getByLabelText('Business or personal name')).not.toHaveAttribute('aria-invalid');
  });

  it('saves a normalised profile when everything is valid', async () => {
    const { onSave } = setup('regular');
    await fillRegular();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      id: 'me',
      name: 'Asha Rao Consulting',
      gstStatus: 'regular',
      gstin: '27AAPFU0939F1ZV',
      address: { line1: '12 Linking Road', city: 'Mumbai', stateCode: '27', country: 'India' },
    });
  });

  it('saves a minimal unregistered profile', async () => {
    const { onSave } = setup('unregistered');
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ gstStatus: 'unregistered', unregisteredNote: true });
  });

  it('asks for the rest of the bank details when one is filled', async () => {
    const { onSave } = setup('unregistered');
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.type(screen.getByLabelText('Bank name'), 'SBI');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Account holder name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('IFSC')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a danger notice when saving fails, and lets the user try again', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValue(undefined);
    render(<ProfileForm initial={emptyProfileForm('unregistered')} submitLabel="Save" onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Storage is full')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Storage is full')).not.toBeInTheDocument());
  });

  it('keeps the user from saving twice at once', async () => {
    let finish: () => void = () => {};
    const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<ProfileForm initial={emptyProfileForm('unregistered')} submitLabel="Save" onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  });
});
```

`apps/web/src/invoice/Onboarding.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

describe('Onboarding', () => {
  it('starts by asking how the seller is registered for GST', () => {
    render(<Onboarding onDone={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Set up your business' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'How are you registered for GST?' });
    expect(group).toBeInTheDocument();
    expect(screen.getByText('You charge GST on your invoices and file GST returns.')).toBeInTheDocument();
    expect(screen.getByText('You pay GST as a flat percentage of turnover and cannot charge it separately.')).toBeInTheDocument();
    expect(screen.getByText(/You issue plain invoices without GST/)).toBeInTheDocument();
  });

  it('needs a choice before continuing', async () => {
    render(<Onboarding onDone={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose how you are registered');
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
  });

  it('moves to the profile form with the chosen status, and reports the saved profile', async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByLabelText('GSTIN')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ name: 'Ravi Kumar', gstStatus: 'unregistered' });
  });

  it('can go back and change the choice', async () => {
    render(<Onboarding onDone={() => {}} />);
    await userEvent.click(screen.getByRole('radio', { name: /Regular GST registration/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: /Regular GST registration/ })).toBeChecked();
  });
});
```

Replace `apps/web/src/invoice/InvoiceApp.test.tsx` with the earlier shell tests adjusted for onboarding, plus the new flows:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { StoreProvider } from '../store/StoreProvider';
import { InvoiceApp } from './InvoiceApp';

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error remove the stub between tests
  delete navigator.storage;
});

function renderApp(store: DataStore = createMemoryStore()) {
  render(
    <StoreProvider factory={() => store}>
      <InvoiceApp />
    </StoreProvider>,
  );
  return store;
}

async function seedProfile(store: DataStore) {
  const storage = createInvoiceStorage(store);
  await storage.profile.save(makeSeller());
  await storage.settings.update({ onboarded: true });
}

describe('InvoiceApp first run', () => {
  it('waits for storage, then shows onboarding with no tabs', async () => {
    renderApp();
    expect(screen.getByText('Opening your invoices…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Set up your business' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Invoices' })).not.toBeInTheDocument();
  });

  it('saves the profile and opens the tool when onboarding is finished', async () => {
    const store = renderApp();
    await screen.findByRole('heading', { name: 'Set up your business' });
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    const storage = createInvoiceStorage(store);
    expect((await storage.profile.get())?.name).toBe('Ravi Kumar');
    expect((await storage.settings.get()).onboarded).toBe(true);
  });
});

describe('InvoiceApp with a saved profile', () => {
  it('goes straight to the tool, with the Invoices tab selected', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    expect(await screen.findByRole('navigation', { name: 'Invoice tool' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('heading', { name: 'Set up your business' })).not.toBeInTheDocument();
  });

  it('shows the saved profile in the Profile tab and saves changes', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await userEvent.click(await screen.findByRole('tab', { name: 'Profile' }));
    const name = screen.getByLabelText('Business or personal name');
    expect(name).toHaveValue('Asha Rao Consulting');
    await userEvent.clear(name);
    await userEvent.type(name, 'Asha Rao Advisory');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect((await createInvoiceStorage(store).profile.get())?.name).toBe('Asha Rao Advisory');
  });

  it('warns when the browser is not keeping data between visits', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <StoreProvider
        factory={() => {
          throw new Error('blocked');
        }}
      >
        <InvoiceApp />
      </StoreProvider>,
    );
    const notice = await screen.findByText('Your browser is not saving data');
    expect(notice).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('download a backup');
  });

  it('does not warn when storage works', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks the browser to keep the data, once', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- ProfileForm Onboarding InvoiceApp`
Expected: FAIL (missing components and the new `InvoiceApp` behaviour).

- [ ] **Step 3: Implement the profile form**

`apps/web/src/invoice/ProfileForm.module.css`:
```css
.form {
  display: grid;
  gap: 1.75rem;
  max-width: 46rem;
}

.section {
  display: grid;
  gap: 1rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.legend {
  margin-bottom: 0.25rem;
  padding: 0;
  font-family: var(--ff-display);
  font-size: 1.25rem;
  font-weight: 700;
}

.pair {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 40rem) {
  .pair {
    grid-template-columns: 1fr 1fr;
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
```

`apps/web/src/invoice/ProfileForm.tsx`:
```tsx
'use client';

import { useRef, useState, type FormEvent } from 'react';
import { formatMoney } from '@solokit/core';
import { IN_RULES_AS_OF, REGISTRATION_THRESHOLDS, type SellerGstStatus } from '@solokit/tax-engines';
import type { SellerProfile } from '@solokit/tool-invoice';
import {
  Button,
  CheckboxField,
  Notice,
  RadioCards,
  SelectField,
  TextAreaField,
  TextField,
  formatIsoDate,
} from '@solokit/ui';
import { LogoField } from './LogoField';
import {
  applyGstin,
  formToProfile,
  issuesByField,
  selectableStates,
  validateProfileForm,
  type ProfileFormState,
} from './profileForm';
import styles from './ProfileForm.module.css';

export const GST_STATUS_OPTIONS: { value: SellerGstStatus; label: string; description: string }[] = [
  { value: 'regular', label: 'Regular GST registration', description: 'You charge GST on your invoices and file GST returns.' },
  {
    value: 'composition',
    label: 'Composition scheme',
    description: 'You pay GST as a flat percentage of turnover and cannot charge it separately.',
  },
  {
    value: 'unregistered',
    label: 'Not registered for GST',
    description: 'Your turnover is below the limit, or you only sell exempt services. You issue plain invoices without GST.',
  },
];

const rupees = (paise: number) => formatMoney(paise).replace(/\.00$/, '');

export interface ProfileFormProps {
  initial: ProfileFormState;
  submitLabel: string;
  onSave: (profile: SellerProfile) => Promise<void> | void;
  processLogo?: (file: File) => Promise<string>;
}

export function ProfileForm({ initial, submitLabel, onSave, processLogo }: ProfileFormProps) {
  const [form, setForm] = useState<ProfileFormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = submitted ? issuesByField(validateProfileForm(form)) : {};
  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const text = (key: keyof ProfileFormState) => ({
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) => set(key, event.target.value as never),
  });
  const taxRegistered = form.gstStatus !== 'unregistered';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (validateProfileForm(form).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formToProfile(form));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Your profile could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>Your business</legend>
        <RadioCards
          legend="How are you registered for GST?"
          name="gstStatus"
          value={form.gstStatus}
          onChange={(value) => set('gstStatus', value as SellerGstStatus)}
          options={GST_STATUS_OPTIONS}
        />
        {form.gstStatus === 'unregistered' ? (
          <Notice title="Check your turnover limit">
            You can stay unregistered while your yearly turnover is below {rupees(REGISTRATION_THRESHOLDS.services)} for services or{' '}
            {rupees(REGISTRATION_THRESHOLDS.goods)} for goods (lower in some states). Rules last checked {formatIsoDate(IN_RULES_AS_OF)}.
            This is not tax advice; confirm with your chartered accountant.
          </Notice>
        ) : null}
        <TextField label="Business or personal name" required autoComplete="organization" {...text('name')} error={errors['name']} />
        {taxRegistered ? (
          <TextField
            label="GSTIN"
            required
            hint="15 characters, for example 27AAPFU0939F1ZV"
            autoComplete="off"
            value={form.gstin}
            onChange={(event) => setForm((current) => applyGstin(current, event.target.value))}
            error={errors['gstin']}
          />
        ) : (
          <CheckboxField
            label="Print “Not registered under GST” on invoices"
            hint="Some clients like to see it. You can switch it off."
            checked={form.unregisteredNote}
            onChange={(event) => set('unregisteredNote', event.target.checked)}
          />
        )}
        <div className={styles.pair}>
          <TextField label="PAN" hint="For example ABCDE1234F" autoComplete="off" {...text('pan')} error={errors['pan']} />
          <TextField label="UDYAM number" hint="Optional, for example UDYAM-MH-19-0012345" autoComplete="off" {...text('udyam')} error={errors['udyam']} />
        </div>
        <LogoField value={form.logoDataUrl} onChange={(dataUrl) => set('logoDataUrl', dataUrl)} {...(processLogo ? { process: processLogo } : {})} />
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Address</legend>
        <TextField label="Address line 1" required autoComplete="address-line1" {...text('line1')} error={errors['address.line1']} />
        <TextField label="Address line 2" autoComplete="address-line2" {...text('line2')} />
        <div className={styles.pair}>
          <TextField label="City" required autoComplete="address-level2" {...text('city')} error={errors['address.city']} />
          <TextField label="PIN code" inputMode="numeric" autoComplete="postal-code" {...text('postalCode')} />
        </div>
        <SelectField
          label="State"
          required={taxRegistered}
          placeholder="Choose your state"
          options={selectableStates()}
          {...text('stateCode')}
          error={errors['address.stateCode']}
        />
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Contact</legend>
        <div className={styles.pair}>
          <TextField label="Email" type="email" autoComplete="email" {...text('email')} error={errors['email']} />
          <TextField label="Phone" type="tel" autoComplete="tel" {...text('phone')} />
        </div>
        <TextField label="Website" type="url" autoComplete="url" {...text('website')} />
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Payment details</legend>
        <p>Printed on your invoices so clients know where to pay. All optional.</p>
        <div className={styles.pair}>
          <TextField label="Account holder name" autoComplete="off" {...text('bankAccountName')} error={errors['bank.accountName']} />
          <TextField label="Account number" inputMode="numeric" autoComplete="off" {...text('bankAccountNumber')} error={errors['bank.accountNumber']} />
          <TextField label="IFSC" hint="For example HDFC0001234" autoComplete="off" {...text('ifsc')} error={errors['bank.ifsc']} />
          <TextField label="Bank name" autoComplete="off" {...text('bankName')} error={errors['bank.bankName']} />
        </div>
        <TextField label="Branch" autoComplete="off" {...text('branch')} />
        <TextField label="UPI ID" hint="Adds a QR code to your rupee invoices, for example name@bank" autoComplete="off" {...text('upiId')} error={errors['upiId']} />
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Invoice defaults</legend>
        <TextField
          label="Invoice number prefix"
          hint="Optional, up to 4 characters, for example INV/. Numbers look like INV/2026-27/0001."
          autoComplete="off"
          {...text('invoicePrefix')}
          error={errors['invoicePrefix']}
        />
        {form.gstStatus === 'regular' ? (
          <TextField label="LUT number" hint="Only needed if you export services without paying GST." autoComplete="off" {...text('lutNumber')} />
        ) : null}
        <TextAreaField label="Default notes" hint="Printed on every new invoice, for example a thank-you." {...text('defaultNotes')} />
        <TextAreaField label="Default terms" hint="For example “Payment within 15 days.”" {...text('defaultTerms')} />
      </fieldset>

      {saveError ? <Notice tone="danger" title="Could not save">{saveError}</Notice> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
```
Notes for the implementer: `Button` renders `type="button"` by default and accepts `type` through its props (it spreads the remaining button props after the default). The error summary relies on field-level messages only. The `text()` helper's `onChange` is typed loosely on purpose; keep the casts local to it.

- [ ] **Step 4: Implement onboarding**

`apps/web/src/invoice/Onboarding.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { SellerGstStatus } from '@solokit/tax-engines';
import type { SellerProfile } from '@solokit/tool-invoice';
import { Button, RadioCards } from '@solokit/ui';
import { GST_STATUS_OPTIONS, ProfileForm } from './ProfileForm';
import { emptyProfileForm } from './profileForm';

export interface OnboardingProps {
  onDone: (profile: SellerProfile) => Promise<void> | void;
  processLogo?: (file: File) => Promise<string>;
}

export function Onboarding({ onDone, processLogo }: OnboardingProps) {
  const [status, setStatus] = useState<SellerGstStatus | undefined>(undefined);
  const [step, setStep] = useState<'status' | 'profile'>('status');
  const [missing, setMissing] = useState(false);

  if (step === 'profile' && status) {
    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem' }}>Your business details</h2>
        <div>
          <Button variant="ghost" onClick={() => setStep('status')}>
            Back
          </Button>
        </div>
        <ProfileForm
          initial={emptyProfileForm(status)}
          submitLabel="Save and continue"
          onSave={onDone}
          {...(processLogo ? { processLogo } : {})}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '40rem' }}>
      <h2 style={{ fontSize: '1.8rem' }}>Set up your business</h2>
      <p>This takes a minute. Your details stay on this device and appear on your invoices.</p>
      <RadioCards
        legend="How are you registered for GST?"
        name="onboardingStatus"
        value={status}
        onChange={(value) => {
          setStatus(value as SellerGstStatus);
          setMissing(false);
        }}
        options={GST_STATUS_OPTIONS}
        error={missing ? 'Choose how you are registered' : undefined}
      />
      <div>
        <Button
          onClick={() => {
            if (!status) {
              setMissing(true);
              return;
            }
            setStep('profile');
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
```
(The onboarding page has one `<h1>` already from `PageShell`; its steps use `<h2>`. The first test queries the heading "Set up your business" by role without a level, so `<h2>` is fine.)

- [ ] **Step 5: Update the app shell**

Replace `apps/web/src/invoice/InvoiceApp.tsx` with:
```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SellerProfile } from '@solokit/tool-invoice';
import { Notice } from '@solokit/ui';
import { Onboarding } from './Onboarding';
import { ProfileForm } from './ProfileForm';
import { profileToForm } from './profileForm';
import { requestPersistentStorage } from './persist';
import { useInvoiceStorage } from './useInvoiceStorage';
import styles from './InvoiceApp.module.css';

type ViewName = 'list' | 'profile';

const TABS: { name: ViewName; label: string }[] = [
  { name: 'list', label: 'Invoices' },
  { name: 'profile', label: 'Profile' },
];

export function InvoiceApp() {
  const { storage, ready, persistent } = useInvoiceStorage();
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  const [view, setView] = useState<ViewName>('list');
  const [savedNotice, setSavedNotice] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    void storage.profile.get().then((found) => {
      if (!cancelled) setProfile(found ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (ready && persistent && profile && !asked.current) {
      asked.current = true;
      void requestPersistentStorage();
    }
  }, [ready, persistent, profile]);

  const saveProfile = useCallback(
    async (next: SellerProfile) => {
      if (!storage) return;
      await storage.profile.save(next);
      await storage.settings.update({ onboarded: true });
      setProfile(next);
    },
    [storage],
  );

  if (!ready || profile === undefined) return <p>Opening your invoices…</p>;

  const storageWarning = !persistent ? (
    <Notice tone="danger" title="Your browser is not saving data">
      What you enter will be lost when you close this tab. Use a normal browser window, or download a backup before you leave.
    </Notice>
  ) : null;

  if (profile === null) {
    return (
      <div className={styles.app}>
        {storageWarning}
        <Onboarding onDone={saveProfile} />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      {storageWarning}
      <nav aria-label="Invoice tool">
        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              type="button"
              role="tab"
              aria-selected={view === tab.name}
              className={styles.tab}
              onClick={() => {
                setView(tab.name);
                setSavedNotice(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div className={styles.panel}>
        {view === 'list' ? (
          <p className={styles.empty}>Your invoices will appear here.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {savedNotice ? <Notice tone="info">Saved</Notice> : null}
            <ProfileForm
              initial={profileToForm(profile)}
              submitLabel="Save changes"
              onSave={async (next) => {
                await saveProfile(next);
                setSavedNotice(true);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```
Note: the "Saved" notice must appear after saving and disappear when the user leaves the tab (handled by `setSavedNotice(false)` in the tab click). Because `Notice` with `tone="info"` has `role="status"`, make sure the unregistered turnover notice test in `ProfileForm.test.tsx` renders the form alone (it does).

- [ ] **Step 6: Run tests, typecheck and build**

Run: `pnpm --filter @solokit/web test`
Expected: PASS (all web tests).
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.
Run: `pnpm build`
Expected: "Compiled successfully".
Common issues to check before reporting a failure: `Button` must forward `type="submit"` and `disabled` (it spreads rest props onto the `<button>`); `@solokit/tool-invoice/testing` must resolve in the web package (the export was added in Plan 3B); a `Notice` role clash in a test that renders two notices (use the specific text instead of the role).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): add the profile form and first-run onboarding

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end tests in a real browser

**Files:**
- Modify: `apps/web/package.json`, `.gitignore`, root `package.json`
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/onboarding.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: `pnpm e2e` at the repository root (builds, then runs the Playwright specs against the static export served on port 4180 using the Chrome installed on the machine); `pnpm --filter @solokit/web e2e` runs the specs against an existing build. Screenshots are written to `apps/web/e2e-screenshots/` (ignored by git) for a human to look at.

- [ ] **Step 1: Dependencies and scripts**

In `apps/web/package.json` add to `devDependencies`:
```json
    "@playwright/test": "^1.64.0",
    "serve": "^14.2.0",
```
and to `scripts`:
```json
    "e2e": "playwright test",
```
In the root `package.json` `scripts` add:
```json
    "e2e": "pnpm build && pnpm --filter @solokit/web e2e",
```
Append to `.gitignore`:
```
apps/web/e2e-screenshots/
apps/web/test-results/
apps/web/playwright-report/
```
Run: `pnpm install`
Expected: exits 0. (Do NOT run `playwright install`: the specs use the installed Chrome through `channel: 'chrome'`, so no browser is downloaded. If pnpm asks to approve a build script for a new package, report the package name instead of approving.)

- [ ] **Step 2: Playwright configuration**

`apps/web/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4180',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'pnpm exec serve out -l 4180 --no-clipboard',
    url: 'http://localhost:4180',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 3: Write the end-to-end tests**

`apps/web/e2e/onboarding.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

const shots = 'e2e-screenshots';

test.describe('first run of the invoice tool', () => {
  test('a new visitor sets up an unregistered business and it is still there after a reload', async ({ page }) => {
    await page.goto('/tools/invoice/');
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toBeVisible();
    await page.screenshot({ path: `${shots}/onboarding-status.png`, fullPage: true });

    await page.getByRole('radio', { name: /Not registered for GST/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Check your turnover limit')).toBeVisible();
    await expect(page.getByLabel('GSTIN')).toHaveCount(0);

    await page.getByLabel('Business or personal name').fill('Ravi Kumar Design');
    await page.getByLabel('Address line 1').fill('4 Park Street');
    await page.getByLabel('City').fill('Kolkata');
    await page.screenshot({ path: `${shots}/onboarding-profile-unregistered.png`, fullPage: true });
    await page.getByRole('button', { name: 'Save and continue' }).click();

    await expect(page.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Invoices' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Profile' }).click();
    await expect(page.getByLabel('Business or personal name')).toHaveValue('Ravi Kumar Design');
    await page.screenshot({ path: `${shots}/profile-after-reload.png`, fullPage: true });
  });

  test('a regular seller is told what is wrong with the GSTIN, and the state fills in from a valid one', async ({ page }) => {
    await page.goto('/tools/invoice/');
    await page.getByRole('radio', { name: /Regular GST registration/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel('Business or personal name').fill('Asha Rao Consulting');
    await page.getByLabel('GSTIN').fill('27AAPFU0939F1ZX');
    await page.getByLabel('Address line 1').fill('12 Linking Road');
    await page.getByLabel('City').fill('Mumbai');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText('GSTIN check character does not match')).toBeVisible();
    await expect(page.getByLabel('GSTIN')).toBeFocused();
    await page.screenshot({ path: `${shots}/profile-gstin-error.png`, fullPage: true });

    await page.getByLabel('GSTIN').fill('27aapfu0939f1zv');
    await expect(page.getByLabel('State')).toHaveValue('27');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByRole('tab', { name: 'Invoices' })).toBeVisible();

    await page.getByRole('tab', { name: 'Profile' }).click();
    await expect(page.getByLabel('GSTIN')).toHaveValue('27AAPFU0939F1ZV');
  });

  test('bank details must be complete once started', async ({ page }) => {
    await page.goto('/tools/invoice/');
    await page.getByRole('radio', { name: /Not registered for GST/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Business or personal name').fill('Ravi Kumar');
    await page.getByLabel('Address line 1').fill('4 Park Street');
    await page.getByLabel('City').fill('Kolkata');
    await page.getByLabel('Bank name').fill('State Bank of India');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByLabel('Account holder name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('IFSC')).toHaveAttribute('aria-invalid', 'true');
  });

  test('the tool page reopens offline once the site has been visited', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null || true);
    await page.goto('/tools/invoice/');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Set up your business' })).toBeVisible();
    await page.screenshot({ path: `${shots}/tool-offline.png`, fullPage: true });
  });

  test('works on a phone-sized screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tools/invoice/');
    await page.getByRole('radio', { name: /Regular GST registration/ }).check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.screenshot({ path: `${shots}/profile-mobile.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
```
The service worker is only registered by production builds; each Playwright test starts from a fresh browser context, so the first test visit may not yet be controlled by the worker. If the offline test is flaky, wait for `navigator.serviceWorker.controller` to be non-null after a second navigation before going offline (reload once more), and keep the assertion that the page renders offline; do not delete the test.

- [ ] **Step 4: Run the end-to-end tests**

Run: `pnpm e2e`
Expected: the build succeeds, the static server starts on port 4180, and all 5 specs pass in Chrome. Screenshots appear in `apps/web/e2e-screenshots/`.
If a spec fails, read the failure and the screenshot; fix the product code or the spec as appropriate and say which. If Chrome cannot be launched (`channel: 'chrome'`), report the exact error: do not download a browser.

- [ ] **Step 5: Look at the screenshots**

Open each PNG in `apps/web/e2e-screenshots/` with the image viewer tool (Read) and note anything that looks wrong: overlapping text, unreadable colours in either theme, a layout that is too wide or too narrow, missing labels. Put the notes in your report. Do not commit the screenshots.

- [ ] **Step 6: README and verification**

In `README.md` add to the "Develop" code block after `pnpm preview ...`:
```
    pnpm e2e          # builds, then runs the browser tests (uses the Chrome installed on your machine)
```
and change the Status "Next" line to `- Next: the invoice editor, live preview and invoice list.`
Run from the repo root: `pnpm install` (exit 0), `pnpm test` (every package passes), `pnpm typecheck` (no errors), `pnpm build` ("Compiled successfully").

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test(web): add browser tests for onboarding, profile, offline and mobile

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (this plan's scope):**
- Onboarding by GST status first; fields adapt to the status; unregistered default is the simplest path: Tasks 3 and 5.
- Seller profile (name, GSTIN/PAN/UDYAM, address, contact, bank, UPI, LUT, prefix, default notes/terms, logo) saved locally: Tasks 3 to 5.
- Logo handling (upload, resize in browser, transparency kept, PNG output, removal): Task 4.
- Local-first storage with the non-persistent warning, `navigator.storage.persist()`: Task 2.
- Turnover-threshold information with the "not tax advice" wording and the rules date: Task 5.
- Accessibility floor (labels, errors, focus, noValidate), responsive and offline checks in a real browser: Tasks 1, 5 and 6.
- Deferred to Plans 3C-2 and 3C-3: client picker and line items, editor, live PDF preview, issue and download, invoice list, registry flip to "available", theme and logo styling choices in invoices, backup and restore UI, default theme, polish.

**Placeholder scan:** none; every code step has complete code. The only judgement calls left to the implementer are marked ("if the offline test is flaky", "if normaliseSeller keeps an empty line2").

**Type consistency:** `ProfileFormState` and its helpers (Task 3) are consumed unchanged by `ProfileForm` and `Onboarding` (Task 5). `GST_STATUS_OPTIONS` is exported from `ProfileForm.tsx` and reused by `Onboarding`. `useInvoiceStorage` (Task 2) returns the `storage` that `InvoiceApp` uses in Task 5. `LogoField`'s `process` prop matches `ProfileForm`'s `processLogo`.
