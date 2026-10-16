import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeProfile } from '@solokit/profile/testing';
import { Onboarding } from './Onboarding';

describe('progressive onboarding: the contract tool', () => {
  it('asks a new Business only for name, address and email, and saves a profile with the GST status still open', async () => {
    const onDone = vi.fn();
    render(<Onboarding tool="contract" onDone={onDone} />);
    expect(screen.getByRole('heading', { name: 'Set up your business' })).toHaveFocus();
    expect(screen.getByLabelText('Business or personal name')).toBeInTheDocument();
    expect(screen.getByLabelText('Address line 1')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    for (const absent of ['GSTIN', 'State', 'Phone', 'Bank name']) expect(screen.queryByLabelText(absent)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'How are you registered for GST?' })).not.toBeInTheDocument();
    expect(screen.queryByText(/invoice tool/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Business or personal name')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(screen.getByLabelText('Business or personal name')).toHaveFocus());

    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha Rao');
    await userEvent.type(screen.getByLabelText('Address line 1'), '12 Linking Road');
    await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@example.com',
      address: { line1: '12 Linking Road', city: 'Mumbai', country: 'India' },
      gstUnconfirmed: true,
    });
  });

  it('asks only for what the saved profile lacks, with the reason for each', () => {
    render(<Onboarding tool="contract" profile={makeProfile({ email: undefined })} onDone={vi.fn()} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByText('Where legal notices are sent')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Address line 1')).not.toBeInTheDocument();
  });

  it('offers to skip, for a tool that works without the details', async () => {
    const onSkip = vi.fn();
    render(<Onboarding tool="contract" onDone={vi.fn()} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('starts the name field with the Business name when it is given', () => {
    render(<Onboarding tool="contract" suggestedName="Studio Two" onDone={vi.fn()} />);
    expect(screen.getByLabelText('Business or personal name')).toHaveValue('Studio Two');
  });

  it('shows a failure to save and lets the person try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onDone = vi.fn().mockRejectedValueOnce(new Error('full')).mockResolvedValue(undefined);
    render(<Onboarding tool="contract" profile={makeProfile({ email: undefined })} onDone={onDone} />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.example');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('Your details could not be saved. Please try again.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(2));
  });
});

describe('progressive onboarding: the invoice tool reusing a profile another tool started', () => {
  const started = makeProfile({ gstStatus: 'unregistered', gstUnconfirmed: true, gstin: undefined, bank: undefined, upiId: undefined });

  it('asks only for the GST status first, and nothing the profile already has', async () => {
    const onDone = vi.fn();
    render(<Onboarding tool="invoice" profile={started} onDone={onDone} />);
    expect(screen.getByRole('group', { name: 'How are you registered for GST?' })).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Address line 1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(screen.getByText('Choose how you are registered')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    const saved = onDone.mock.calls[0]?.[0];
    expect(saved).toMatchObject({ name: 'Asha Rao Consulting', gstStatus: 'unregistered', email: 'asha@example.com' });
    expect(saved).not.toHaveProperty('gstUnconfirmed');
  });

  it('asks for the state and GSTIN once a registered status is chosen', async () => {
    const onDone = vi.fn();
    render(<Onboarding tool="invoice" profile={{ ...started, address: { line1: '12 Linking Road', city: 'Mumbai', country: 'India' } }} onDone={onDone} />);
    expect(screen.queryByLabelText('GSTIN')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Regular GST registration/ }));
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('Enter your GSTIN')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('GSTIN'), '27aapfu0939f1zv');
    expect(screen.getByLabelText('State')).toHaveValue('27');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ gstStatus: 'regular', gstin: '27AAPFU0939F1ZV', address: { stateCode: '27' } });
  });

  it('asks only for the GSTIN when a registered profile lacks it', async () => {
    render(<Onboarding tool="invoice" profile={makeProfile({ gstin: undefined })} onDone={vi.fn()} />);
    expect(screen.getByLabelText('GSTIN')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'How are you registered for GST?' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
  });
});
