'use client';

import { useState } from 'react';
import type { SellerGstStatus } from '@solokit/tax-engines';
import type { SellerProfile } from '@solokit/tool-invoice';
import { Button, RadioCards } from '@solokit/ui';
import { GST_STATUS_OPTIONS, ProfileForm } from './ProfileForm';
import { emptyProfileForm } from './profileFormState';

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
