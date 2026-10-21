'use client';

import { useState } from 'react';
import type { SellerGstStatus } from '@solokit/tax-engines';
import type { BusinessProfile, ProfileToolId } from '@solokit/profile';
import { Button, RadioCards } from '@solokit/ui';
import { GST_STATUS_OPTIONS, ProfileForm } from './ProfileForm';
import { emptyProfileForm } from './profileFormState';
import { RequiredFieldsStep } from './RequiredFieldsStep';

export interface OnboardingProps {
  onDone: (profile: BusinessProfile) => Promise<void> | void;
  processLogo?: (file: File) => Promise<string>;
  /** The tool being opened. Default: the invoice tool. */
  tool?: ProfileToolId;
  /** The Business's profile as saved so far. Without one, the invoice tool runs the full first-use flow. */
  profile?: BusinessProfile | undefined;
  /** A name to start with, for example the Business's name. */
  suggestedName?: string;
  /** Offers "Skip for now" on the compact step, for a tool that works without the details. */
  onSkip?: () => void;
}

const PURPOSE: Record<ProfileToolId, string> = { invoice: 'Your invoices', contract: 'Your agreements' };

/**
 * The first-use step of a tool. Which fields it asks for comes from `PROFILE_REQUIREMENTS`: only what this tool needs and
 * the Business's profile does not have yet. A brand new invoice user gets the full flow (GST status, then the whole
 * profile form); everyone else gets a compact step with just the missing fields. Either way it saves to the shared
 * profile, so the next tool already has the details.
 */
export function Onboarding({ onDone, processLogo, tool = 'invoice', profile, suggestedName, onSkip }: OnboardingProps) {
  if (tool !== 'invoice' || profile !== undefined) {
    return <RequiredFieldsStep tool={tool} profile={profile} purpose={PURPOSE[tool]} onDone={onDone} {...(suggestedName ? { suggestedName } : {})} {...(onSkip ? { onSkip } : {})} />;
  }
  return <FirstInvoiceSetup onDone={onDone} {...(processLogo ? { processLogo } : {})} {...(suggestedName ? { suggestedName } : {})} />;
}

function FirstInvoiceSetup({ onDone, processLogo, suggestedName }: Pick<OnboardingProps, 'onDone' | 'processLogo' | 'suggestedName'>) {
  const [status, setStatus] = useState<SellerGstStatus | undefined>(undefined);
  const [step, setStep] = useState<'status' | 'profile'>('status');
  const [missing, setMissing] = useState(false);

  if (step === 'profile' && status) {
    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem' }}>Your business details</h2>
        <div>
          <Button variant="ghost" onClick={() => setStep('status')}>
            Back
          </Button>
        </div>
        <ProfileForm
          initial={{ ...emptyProfileForm(status), ...(suggestedName ? { name: suggestedName } : {}) }}
          submitLabel="Save and continue"
          onSave={onDone}
          {...(processLogo ? { processLogo } : {})}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '40rem' }}>
      <h2 style={{ fontSize: '1.5rem' }}>Set up your business</h2>
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
