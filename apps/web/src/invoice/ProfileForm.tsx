'use client';

import { useRef, useState, type FormEvent } from 'react';
import { formatMoney } from '@solokit/core';
import { IN_RULES_AS_OF, REGISTRATION_THRESHOLDS, type SellerGstStatus } from '@solokit/tax-engines';
import type { BusinessProfile } from '@solokit/profile';
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
} from './profileFormState';
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
  onSave: (profile: BusinessProfile) => Promise<void> | void;
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
      console.error('Could not save the profile', error);
      setSaveError('Your profile could not be saved. Please try again.');
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
