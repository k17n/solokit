'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { formatMoney } from '@solokit/core';
import { IN_RULES_AS_OF, REGISTRATION_THRESHOLDS, type SellerGstStatus } from '@solokit/tax-engines';
import { missingForSetup, type BrandColours, type BusinessProfile, type PaletteDeps } from '@solokit/profile';
import {
  Badge,
  Button,
  CheckboxField,
  Notice,
  RadioCards,
  SelectField,
  TextAreaField,
  TextField,
  formatIsoDate,
} from '@solokit/ui';
import { SETUP_STEPS, type SetupStep } from '../setup/links';
import { BrandColoursField, type BrandFormValue } from './BrandColoursField';
import { LogoField } from './LogoField';
import {
  applyGstin,
  formToProfile,
  issuesByField,
  selectableStates,
  validateProfileForm,
  type ProfileFormState,
} from './profileFormState';
import { TOOL_LABELS, toolsUsing, type BusinessSection } from './usage';
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

interface StepInfo {
  title: string;
  lede: string;
  optional: boolean;
  /** Which "Used by" tags to show. */
  section: BusinessSection;
}

export const STEP_INFO: Readonly<Record<SetupStep, StepInfo>> = {
  tax: { title: 'Tax registration', lede: 'This decides whether your invoices charge GST and what they are called.', optional: false, section: 'details' },
  details: { title: 'Business details', lede: 'Printed as the seller on invoices and as a party on agreements.', optional: false, section: 'details' },
  brand: { title: 'Logo and brand colours', lede: 'Optional. Your documents can carry your logo and colours.', optional: true, section: 'logo' },
  payments: { title: 'Getting paid', lede: 'Optional. Printed on your invoices so clients know where to pay.', optional: true, section: 'payments' },
  defaults: { title: 'Invoice defaults', lede: 'Optional. Starting values for every new invoice.', optional: true, section: 'defaults' },
};

/** The error for a required field that is still empty. */
const REQUIRED_MESSAGE: Record<string, string> = {
  name: 'Enter your name or business name',
  gstStatus: 'Choose how you are registered',
  'address.line1': 'Enter the first line of your address',
  'address.city': 'Enter your city',
  'address.stateCode': 'Choose your state',
  gstin: 'Enter your GSTIN',
  email: 'Enter your email address',
};

/** The step that holds a field, by its dotted path. Anything unknown is shown with the business details. */
export function stepOf(path: string): SetupStep {
  if (path === 'gstStatus') return 'tax';
  if (path === 'logoDataUrl' || path.startsWith('brand')) return 'brand';
  if (path === 'upiId' || path.startsWith('bank.')) return 'payments';
  if (['invoicePrefix', 'lutNumber', 'defaultNotes', 'defaultTerms'].includes(path)) return 'defaults';
  return 'details';
}

/** Everything wrong with the form, by field: invalid values, and the fields some tool needs that are still empty. */
export function formProblems(form: ProfileFormState): Record<string, string> {
  const problems = issuesByField(validateProfileForm(form));
  for (const requirement of missingForSetup(formToProfile(form))) {
    // The country is always India; the form has no field for it.
    if (requirement.path === 'address.country' || problems[requirement.path]) continue;
    problems[requirement.path] = REQUIRED_MESSAGE[requirement.path] ?? `Enter your ${requirement.label.toLowerCase()}`;
  }
  return problems;
}

export interface ProfileFormProps {
  initial: ProfileFormState;
  /**
   * `setup`: the first time, one step after another, saved at the end. `edit`: any step can be opened from the step
   * list, and the details can be saved from any step.
   */
  mode: 'setup' | 'edit';
  /** The step to open with. Default: the first. */
  startStep?: SetupStep;
  /** The label of the button that saves. */
  submitLabel: string;
  onSave: (profile: BusinessProfile) => Promise<void> | void;
  processLogo?: (file: File) => Promise<string>;
  /** How the logo's colours are read. Tests pass fakes; the default is the browser's canvas. */
  brandDeps?: PaletteDeps | null;
  /** Shown under the brand colours, for example the button that makes a theme from them. Gets the colours as they are in the form now. */
  brandThemeSlot?: (draftBrand: BrandColours | undefined) => ReactNode;
  /** Shown after the buttons, for example a link back without saving. */
  extraActions?: ReactNode;
}

/** Small tags saying which tools read a section, so people know why a field is asked. */
function UsedBy({ section }: { section: BusinessSection }) {
  const tools = toolsUsing(section);
  if (tools.length === 0) return null;
  return (
    <p className={styles.usedBy}>
      <span>Used by</span>
      {tools.map((tool) => (
        <Badge key={tool}>{TOOL_LABELS[tool]}</Badge>
      ))}
    </p>
  );
}

/**
 * The business details, one step at a time: tax registration, business details, logo and brand colours, payment
 * details and invoice defaults. Every field any tool needs is asked here, so no tool has to ask again.
 */
export function ProfileForm({ initial, mode, startStep, submitLabel, onSave, processLogo, brandDeps, brandThemeSlot, extraActions }: ProfileFormProps) {
  const id = useId();
  const [form, setForm] = useState<ProfileFormState>(initial);
  const [step, setStep] = useState<SetupStep>(startStep ?? 'tax');
  /** The furthest step reached. In setup, only steps up to here can be opened from the step list. */
  const [reached, setReached] = useState(() => SETUP_STEPS.indexOf(startStep ?? 'tax'));
  /** Steps whose errors are shown: the person tried to leave them, or to save. */
  const [checked, setChecked] = useState<ReadonlySet<SetupStep>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  const moved = useRef(false);

  // Moving to another step puts focus on its heading, so screen readers hear where they are. Not on first draw.
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
    // On a phone the step list scrolls sideways: keep the open step in sight, without moving the page.
    const list = stepsRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (list && current && list.scrollWidth > list.clientWidth) list.scrollLeft = current.offsetLeft - 16;
  }, [step]);

  const index = SETUP_STEPS.indexOf(step);
  const last = index === SETUP_STEPS.length - 1;
  const info = STEP_INFO[step];
  const problems = formProblems(form);
  const errors: Record<string, string> = {};
  for (const [path, message] of Object.entries(problems)) if (checked.has(stepOf(path))) errors[path] = message;

  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const text = (key: keyof ProfileFormState) => ({
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) => set(key, event.target.value as never),
  });
  const statusChosen = !form.gstUnconfirmed;
  const taxRegistered = statusChosen && form.gstStatus !== 'unregistered';
  const brand: BrandFormValue = { primary: form.brandPrimary, secondary: form.brandSecondary, text: form.brandText, background: form.brandBackground, source: form.brandSource };
  const setBrand = (next: BrandFormValue) =>
    setForm((current) => ({ ...current, brandPrimary: next.primary, brandSecondary: next.secondary, brandText: next.text, brandBackground: next.background, brandSource: next.source }));
  const draftBrand = formToProfile(form).brand;

  function focusFirstProblem() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="radiogroup"] input, fieldset[aria-invalid="true"] input')?.focus());
  }

  function goTo(target: SetupStep) {
    moved.current = true;
    setStep(target);
    setReached((current) => Math.max(current, SETUP_STEPS.indexOf(target)));
  }

  function stepHasProblems(target: SetupStep): boolean {
    return Object.keys(problems).some((path) => stepOf(path) === target);
  }

  function next() {
    setChecked((current) => new Set(current).add(step));
    if (stepHasProblems(step)) {
      focusFirstProblem();
      return;
    }
    const following = SETUP_STEPS[index + 1];
    if (following) goTo(following);
  }

  async function save() {
    if (saving) return;
    setChecked(new Set(SETUP_STEPS));
    const firstBad = SETUP_STEPS.find(stepHasProblems);
    if (firstBad) {
      if (firstBad !== step) goTo(firstBad);
      focusFirstProblem();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formToProfile(form));
    } catch (error) {
      console.error('Could not save the profile', error);
      setSaveError('Your details could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter in a field moves on during setup, and saves once there is nothing left to ask.
    if (mode === 'setup' && !last) next();
    else void save();
  }

  return (
    <div className={styles.wizard}>
      <nav aria-label="Setup steps" className={styles.stepsNav}>
        <ol ref={stepsRef} className={styles.steps}>
          {SETUP_STEPS.map((candidate, position) => {
            const reachable = mode === 'edit' || position <= reached;
            const done = mode === 'setup' && position < reached && candidate !== step;
            return (
              <li key={candidate}>
                <button
                  type="button"
                  className={styles.stepButton}
                  aria-current={candidate === step ? 'step' : undefined}
                  disabled={!reachable}
                  onClick={() => goTo(candidate)}
                >
                  <span className={styles.stepNumber} data-done={done || undefined} aria-hidden="true">
                    {done ? '✓' : position + 1}
                  </span>
                  <span className={styles.stepName}>
                    {STEP_INFO[candidate].title}
                    {STEP_INFO[candidate].optional ? <span className={styles.stepOptional}>Optional</span> : null}
                  </span>
                  {done ? <span className="sr-only">, done</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-title`}>
        <header className={styles.stepHead}>
          <p className={styles.stepCount}>
            Step {index + 1} of {SETUP_STEPS.length}
          </p>
          <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            {info.title}
          </h2>
          <p className={styles.stepLede}>{info.lede}</p>
          <UsedBy section={info.section} />
        </header>

        {step === 'tax' ? (
          <div className={styles.section}>
            <RadioCards
              legend="How are you registered for GST?"
              name={`${id}-gstStatus`}
              value={statusChosen ? form.gstStatus : undefined}
              onChange={(value) =>
                setForm((current) => {
                  const { gstUnconfirmed: _placeholder, ...rest } = current;
                  return { ...rest, gstStatus: value as SellerGstStatus };
                })
              }
              options={GST_STATUS_OPTIONS}
              error={errors['gstStatus']}
            />
            {form.gstStatus === 'unregistered' && statusChosen ? (
              <>
                <Notice title="Check your turnover limit">
                  You can stay unregistered while your yearly turnover is below {rupees(REGISTRATION_THRESHOLDS.services)} for services or{' '}
                  {rupees(REGISTRATION_THRESHOLDS.goods)} for goods (lower in some states). Rules last checked {formatIsoDate(IN_RULES_AS_OF)}.
                  This is not tax advice; confirm with your chartered accountant.
                </Notice>
                <CheckboxField
                  label="Print “Not registered under GST” on invoices"
                  hint="Some clients like to see it. You can switch it off."
                  checked={form.unregisteredNote}
                  onChange={(event) => set('unregisteredNote', event.target.checked)}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {step === 'details' ? (
          <div className={styles.section}>
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
            ) : null}
            <div className={styles.pair}>
              <TextField label="PAN" hint="For example ABCDE1234F" autoComplete="off" {...text('pan')} error={errors['pan']} />
              <TextField label="UDYAM number" hint="Optional, for example UDYAM-MH-19-0012345" autoComplete="off" {...text('udyam')} error={errors['udyam']} />
            </div>

            <h3 className={styles.sub}>Address</h3>
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

            <h3 className={styles.sub}>Contact</h3>
            <div className={styles.pair}>
              <TextField label="Email" type="email" required hint="Where clients and legal notices reach you" autoComplete="email" {...text('email')} error={errors['email']} />
              <TextField label="Phone" type="tel" autoComplete="tel" {...text('phone')} />
            </div>
            <TextField label="Website" type="url" autoComplete="url" {...text('website')} />
          </div>
        ) : null}

        {step === 'brand' ? (
          <div className={styles.section}>
            <LogoField value={form.logoDataUrl} onChange={(dataUrl) => set('logoDataUrl', dataUrl)} {...(processLogo ? { process: processLogo } : {})} />
            <BrandColoursField logoDataUrl={form.logoDataUrl} value={brand} onChange={setBrand} errors={errors} {...(brandDeps !== undefined ? { deps: brandDeps } : {})} />
            {brandThemeSlot ? brandThemeSlot(draftBrand) : null}
          </div>
        ) : null}

        {step === 'payments' ? (
          <div className={styles.section}>
            <div className={styles.pair}>
              <TextField label="Account holder name" autoComplete="off" {...text('bankAccountName')} error={errors['bank.accountName']} />
              <TextField label="Account number" inputMode="numeric" autoComplete="off" {...text('bankAccountNumber')} error={errors['bank.accountNumber']} />
              <TextField label="IFSC" hint="For example HDFC0001234" autoComplete="off" {...text('ifsc')} error={errors['bank.ifsc']} />
              <TextField label="Bank name" autoComplete="off" {...text('bankName')} error={errors['bank.bankName']} />
            </div>
            <TextField label="Branch" autoComplete="off" {...text('branch')} />
            <TextField label="UPI ID" hint="Adds a QR code to your rupee invoices, for example name@bank" autoComplete="off" {...text('upiId')} error={errors['upiId']} />
          </div>
        ) : null}

        {step === 'defaults' ? (
          <div className={styles.section}>
            <TextField
              label="Invoice number prefix"
              hint="Optional, up to 4 characters, for example INV/. Numbers look like INV/2026-27/0001."
              autoComplete="off"
              {...text('invoicePrefix')}
              error={errors['invoicePrefix']}
            />
            {form.gstStatus === 'regular' && statusChosen ? (
              <TextField label="LUT number" hint="Only needed if you export services without paying GST." autoComplete="off" {...text('lutNumber')} />
            ) : null}
            <TextAreaField label="Default notes" hint="Printed on every new invoice, for example a thank-you." {...text('defaultNotes')} />
            <TextAreaField label="Default terms" hint="For example “Payment within 15 days.”" {...text('defaultTerms')} />
          </div>
        ) : null}

        {saveError ? (
          <Notice tone="danger" title="Could not save">
            {saveError}
          </Notice>
        ) : null}

        <div className={styles.actions}>
          {index > 0 ? (
            <Button variant="ghost" onClick={() => goTo(SETUP_STEPS[index - 1] as SetupStep)}>
              Back
            </Button>
          ) : null}
          {mode === 'setup' && !last ? <Button type="submit">Continue</Button> : null}
          {mode === 'edit' && !last ? (
            <Button variant="secondary" onClick={next}>
              Next: {STEP_INFO[SETUP_STEPS[index + 1] as SetupStep].title}
            </Button>
          ) : null}
          {mode === 'edit' || last ? (
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : submitLabel}
            </Button>
          ) : null}
          {extraActions}
        </div>
      </form>
    </div>
  );
}
