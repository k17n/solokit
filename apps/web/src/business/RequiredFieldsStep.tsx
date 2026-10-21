'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { PROFILE_REQUIREMENTS, missingFields, type BusinessProfile, type ProfileRequirement, type ProfileToolId } from '@solokit/profile';
import type { SellerGstStatus } from '@solokit/tax-engines';
import { Button, Notice, RadioCards, SelectField, TextField } from '@solokit/ui';
import { GST_STATUS_OPTIONS } from './ProfileForm';
import { applyGstin, emptyProfileForm, formToProfile, issuesByField, profileToForm, selectableStates, validateProfileForm, type ProfileFormState } from './profileFormState';

export interface RequiredFieldsStepProps {
  tool: ProfileToolId;
  /** The profile saved so far. Undefined when the Business has none yet. */
  profile: BusinessProfile | undefined;
  /** A name to start the name field with, for example the Business's name. */
  suggestedName?: string;
  onDone: (profile: BusinessProfile) => Promise<void> | void;
  /** Shows a "Skip for now" button, for tools that work without the details. */
  onSkip?: () => void;
  /** What the person is setting up for, in the lede: "your invoices", "your agreements". */
  purpose: string;
}

const isEmpty = (value: string) => value.trim() === '';

/** The error for a field that is still empty, in the words the full form uses. */
const REQUIRED_MESSAGE: Record<string, string> = {
  name: 'Enter your name or business name',
  'address.line1': 'Enter the first line of your address',
  'address.city': 'Enter your city',
  'address.stateCode': 'Choose your state',
  gstin: 'Enter your GSTIN',
  email: 'Enter your email address',
  phone: 'Enter your phone number',
};

/** The requirement's value in the form, or undefined for a path the form has no field for. */
function formValue(form: ProfileFormState, path: string): string | undefined {
  switch (path) {
    case 'name':
      return form.name;
    case 'address.line1':
      return form.line1;
    case 'address.city':
      return form.city;
    case 'address.stateCode':
      return form.stateCode;
    case 'gstin':
      return form.gstin;
    case 'email':
      return form.email;
    case 'phone':
      return form.phone;
    default:
      return undefined;
  }
}

/**
 * The compact "Set up your business" step: asks only for what this tool needs and the profile does not have yet (from
 * `PROFILE_REQUIREMENTS` and `missingFields`), then saves to the shared profile. The fields that depend on the GST
 * status (state, GSTIN) appear once a registered status is chosen.
 */
export function RequiredFieldsStep({ tool, profile, suggestedName, onDone, onSkip, purpose }: RequiredFieldsStepProps) {
  const [initial] = useState<ProfileFormState>(() => {
    const start = profile ? profileToForm(profile) : { ...emptyProfileForm('unregistered'), gstUnconfirmed: true };
    return start.name === '' && suggestedName ? { ...start, name: suggestedName } : start;
  });
  const [form, setForm] = useState<ProfileFormState>(initial);
  // What was missing when the step opened. It stays fixed, so a field does not vanish while it is being typed.
  const [asked] = useState(() => new Set(missingFields(profile, tool).map((requirement) => requirement.path)));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const statusChosen = !form.gstUnconfirmed;
  const registered = statusChosen && form.gstStatus !== 'unregistered';
  const askStatus = asked.has('gstStatus');
  // The country is always India (the form has no field for it). Fields that depend on the GST status are asked once a
  // registered status is chosen, when the profile lacks them.
  const shown = PROFILE_REQUIREMENTS[tool].filter((requirement) => {
    if (requirement.path === 'address.country') return false;
    if (requirement.when === 'gst-registered') return registered && (asked.has(requirement.path) || (askStatus && isEmpty(formValue(initial, requirement.path) ?? '')));
    return asked.has(requirement.path);
  });
  const shownPaths = new Set(shown.map((requirement) => requirement.path));

  function problems(): Record<string, string> {
    const byField = issuesByField(validateProfileForm(form));
    const result: Record<string, string> = {};
    for (const requirement of shown) {
      const value = formValue(form, requirement.path);
      if (value !== undefined && isEmpty(value) && requirement.need === 'required') result[requirement.path] = REQUIRED_MESSAGE[requirement.path] ?? `Enter your ${requirement.label.toLowerCase()}`;
      else if (byField[requirement.path]) result[requirement.path] = byField[requirement.path] as string;
    }
    if (askStatus && !statusChosen) result['gstStatus'] = 'Choose how you are registered';
    return result;
  }

  const errors = submitted ? problems() : {};
  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    const found = problems();
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], input[type="radio"]')?.focus());
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onDone(formToProfile(form));
    } catch (error) {
      console.error('Could not save the profile', error);
      setSaveError('Your details could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function control(requirement: ProfileRequirement): ReactNode {
    const common = { hint: requirement.why, error: errors[requirement.path], required: requirement.need === 'required' } as const;
    switch (requirement.path) {
      case 'name':
        return <TextField key="name" label="Business or personal name" autoComplete="organization" value={form.name} onChange={(event) => set('name', event.target.value)} {...common} />;
      case 'address.line1':
        return <TextField key="line1" label="Address line 1" autoComplete="address-line1" value={form.line1} onChange={(event) => set('line1', event.target.value)} {...common} />;
      case 'address.city':
        return <TextField key="city" label="City" autoComplete="address-level2" value={form.city} onChange={(event) => set('city', event.target.value)} {...common} />;
      case 'address.stateCode':
        return (
          <SelectField key="state" label="State" placeholder="Choose your state" options={selectableStates()} value={form.stateCode} onChange={(event) => set('stateCode', event.target.value)} {...common} />
        );
      case 'gstin':
        return (
          <TextField
            key="gstin"
            label="GSTIN"
            autoComplete="off"
            value={form.gstin}
            onChange={(event) => setForm((current) => applyGstin(current, event.target.value))}
            {...common}
            hint="15 characters, for example 27AAPFU0939F1ZV. Required on a tax invoice."
          />
        );
      case 'email':
        return <TextField key="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={(event) => set('email', event.target.value)} {...common} />;
      case 'phone':
        return <TextField key="phone" label="Phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} {...common} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '40rem' }}>
      <h2 ref={headingRef} tabIndex={-1} style={{ fontSize: '1.5rem' }}>
        Set up your business
      </h2>
      <p>
        {purpose} need a few details about you. Add them once and every SoloKit tool uses them. They stay on this device.
      </p>
      <form ref={formRef} onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1.1rem' }}>
        {askStatus ? (
          <RadioCards
            legend="How are you registered for GST?"
            name="setupStatus"
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
        ) : null}
        {PROFILE_REQUIREMENTS[tool].filter((requirement) => shownPaths.has(requirement.path) && requirement.path !== 'gstStatus').map(control)}
        {saveError ? (
          <Notice tone="danger" title="Could not save">
            {saveError}
          </Notice>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save and continue'}
          </Button>
          {onSkip ? (
            <Button variant="secondary" disabled={saving} onClick={onSkip}>
              Skip for now
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
