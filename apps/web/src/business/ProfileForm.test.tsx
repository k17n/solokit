import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SetupStep } from '../setup/links';
import { ProfileForm, type ProfileFormProps } from './ProfileForm';
import { emptyProfileForm, type ProfileFormState } from './profileFormState';
import { RED_LOGO, fakePaletteDeps } from './testDeps';

/** A form that passes every step: an unregistered seller with the basics filled in. */
const COMPLETE: ProfileFormState = { ...emptyProfileForm('unregistered'), name: 'Ravi', line1: '4 Park Street', city: 'Kolkata', email: 'ravi@example.com' };

function setup(props: Partial<ProfileFormProps> = {}) {
  const onSave = props.onSave ?? vi.fn().mockResolvedValue(undefined);
  render(<ProfileForm mode="setup" initial={emptyProfileForm('regular')} submitLabel="Finish setup" {...props} onSave={onSave} />);
  return { onSave: onSave as ReturnType<typeof vi.fn> };
}

const continueButton = () => screen.getByRole('button', { name: 'Continue' });
const heading = () => screen.getByRole('heading', { level: 2 });

async function continueTo(step: string) {
  await userEvent.click(continueButton());
  await waitFor(() => expect(heading()).toHaveTextContent(step));
}

async function fillRegularDetails() {
  await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha Rao Consulting');
  await userEvent.type(screen.getByLabelText('GSTIN'), '27aapfu0939f1zv');
  await userEvent.type(screen.getByLabelText('Address line 1'), '12 Linking Road');
  await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
  await userEvent.type(screen.getByLabelText(/^Email/), 'asha@example.com');
}

/** Opens a step from the step list (edit mode, or a step already reached). */
async function open(step: string) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${step}`) }));
}

describe('ProfileForm setup: one step at a time', () => {
  it('starts with the tax registration and lists every step, with only the first one open', () => {
    setup();
    expect(heading()).toHaveTextContent('Tax registration');
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    const steps = screen.getByRole('navigation', { name: 'Setup steps' });
    expect(steps).toHaveTextContent('Tax registration');
    expect(steps).toHaveTextContent('Getting paid');
    expect(screen.getByRole('button', { name: /^Business details/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Finish setup' })).not.toBeInTheDocument();
  });

  it('will not move on until a GST status is chosen', async () => {
    setup({ initial: { ...emptyProfileForm('unregistered'), gstUnconfirmed: true } });
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    await userEvent.click(continueButton());
    expect(heading()).toHaveTextContent('Tax registration');
    expect(screen.getByText('Choose how you are registered')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await continueTo('Business details');
  });

  it('shows the turnover notice and the note for unregistered sellers', async () => {
    setup({ initial: emptyProfileForm('unregistered') });
    expect(screen.getByRole('checkbox', { name: /Not registered under GST/ })).toBeChecked();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Check your turnover limit');
    expect(notice).toHaveTextContent('₹20,00,000');
    expect(notice).toHaveTextContent('13 Oct 2026');
    expect(notice).toHaveTextContent('not tax advice');
  });

  it('asks registered sellers for a GSTIN, and fills the state from it', async () => {
    setup();
    await continueTo('Business details');
    await userEvent.type(screen.getByLabelText('GSTIN'), '29AAGCB7383J1Z4');
    expect(screen.getByLabelText(/^State/)).toHaveValue('29');
  });

  it('does not ask unregistered sellers for a GSTIN or an LUT number', async () => {
    setup({ initial: COMPLETE });
    await continueTo('Business details');
    expect(screen.queryByLabelText('GSTIN')).not.toBeInTheDocument();
    await continueTo('Logo and brand colours');
    await continueTo('Getting paid');
    await continueTo('Invoice defaults');
    expect(screen.queryByLabelText('LUT number')).not.toBeInTheDocument();
  });

  it('shows the errors of a step only when leaving it, focuses the first, and keeps them up to date', async () => {
    setup();
    await continueTo('Business details');
    expect(screen.getByLabelText('Business or personal name')).not.toHaveAttribute('aria-invalid');
    await userEvent.click(continueButton());
    expect(heading()).toHaveTextContent('Business details');
    expect(screen.getByLabelText('Business or personal name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('GSTIN')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(screen.getByLabelText('Business or personal name')).toHaveFocus());
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha');
    expect(screen.getByLabelText('Business or personal name')).not.toHaveAttribute('aria-invalid');
  });

  it('goes through every step and saves a normalised profile at the end', async () => {
    const { onSave } = setup();
    await continueTo('Business details');
    await fillRegularDetails();
    await continueTo('Logo and brand colours');
    await continueTo('Getting paid');
    await continueTo('Invoice defaults');
    expect(screen.getByLabelText('LUT number')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      name: 'Asha Rao Consulting',
      gstStatus: 'regular',
      gstin: '27AAPFU0939F1ZV',
      email: 'asha@example.com',
      address: { line1: '12 Linking Road', city: 'Mumbai', stateCode: '27', country: 'India' },
    });
  });

  it('moves focus to the heading of each new step, and Back returns with what was typed', async () => {
    setup();
    await continueTo('Business details');
    expect(heading()).toHaveFocus();
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(heading()).toHaveTextContent('Tax registration');
    await continueTo('Business details');
    expect(screen.getByLabelText('Business or personal name')).toHaveValue('Asha');
  });

  it('marks the steps that are done, and lets them be opened again', async () => {
    setup({ initial: COMPLETE });
    await continueTo('Business details');
    await continueTo('Logo and brand colours');
    expect(screen.getByRole('button', { name: /^Tax registration\W*done/ })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /^Tax registration\W*done/ }));
    expect(heading()).toHaveTextContent('Tax registration');
  });

  it('asks for the rest of the bank details when one is filled', async () => {
    const { onSave } = setup({ initial: COMPLETE });
    await continueTo('Business details');
    await continueTo('Logo and brand colours');
    await continueTo('Getting paid');
    await userEvent.type(screen.getByLabelText('Bank name'), 'SBI');
    await userEvent.click(continueButton());
    expect(heading()).toHaveTextContent('Getting paid');
    expect(screen.getByLabelText('Account holder name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('IFSC')).toHaveAttribute('aria-invalid', 'true');
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('ProfileForm edit: any step, saved from anywhere', () => {
  function edit(props: Partial<ProfileFormProps> & { startStep?: SetupStep } = {}) {
    return setup({ mode: 'edit', initial: COMPLETE, submitLabel: 'Save changes', ...props });
  }

  it('opens at the step asked for, with every step open and Save on each', async () => {
    edit({ startStep: 'payments' });
    expect(heading()).toHaveTextContent('Getting paid');
    for (const button of screen.getByRole('navigation', { name: 'Setup steps' }).querySelectorAll('button')) expect(button).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: Invoice defaults' })).toBeInTheDocument();
  });

  it('saves straight away from any step', async () => {
    const { onSave } = edit();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ name: 'Ravi', gstStatus: 'unregistered', unregisteredNote: true });
  });

  it('jumps to the step with a problem when saving', async () => {
    const { onSave } = edit({ initial: { ...COMPLETE, email: '' }, startStep: 'defaults' });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(heading()).toHaveTextContent('Business details'));
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(screen.getByLabelText(/^Email/)).toHaveFocus());
  });

  it('says which tools use each step', async () => {
    edit();
    expect(screen.getByRole('form')).toHaveTextContent('Contracts');
    await open('Getting paid');
    const form = screen.getByRole('form');
    expect(form).toHaveTextContent('Invoices and quotes');
    expect(form).not.toHaveTextContent('Contracts');
  });

  it('shows a danger notice when saving fails, and lets the user try again', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValue(undefined);
    edit({ onSave });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Your details could not be saved. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Storage is full')).not.toBeInTheDocument();
    expect(logged).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Your details could not be saved. Please try again.')).not.toBeInTheDocument());
  });

  it('keeps the user from saving twice at once', async () => {
    let finish: () => void = () => {};
    const onSave = vi.fn().mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    edit({ onSave });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled());
  });

  it('saves typed brand colours as a manual source', async () => {
    const { onSave } = edit({ startStep: 'brand' });
    await userEvent.type(screen.getByLabelText('Accent colour'), '7c2d12');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ brand: { primary: '#7C2D12' }, brandSource: 'manual' });
  });

  it('fills brand colours from the logo with "Use my logo colours" and saves them with the logo as their source', async () => {
    const { onSave } = edit({ startStep: 'brand', processLogo: async () => 'data:image/png;base64,AAAA', brandDeps: fakePaletteDeps(RED_LOGO) });
    await userEvent.upload(screen.getByLabelText('Logo'), new File(['x'], 'logo.png', { type: 'image/png' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use my logo colours' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]?.[0];
    expect(saved.brandSource).toBe('logo');
    expect(saved.brand.primary).toMatch(/^#[0-9A-F]{6}$/);
    expect(saved.logoDataUrl).toBe('data:image/png;base64,AAAA');
  });

  it('rejects a brand colour that is not a colour and focuses it', async () => {
    const { onSave } = edit({ startStep: 'brand' });
    await userEvent.type(screen.getByLabelText('Accent colour'), 'blue');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Accent colour')).toHaveFocus());
  });

  it('keeps the link to the brand theme when saving', async () => {
    const { onSave } = edit({ initial: { ...COMPLETE, brandTheme: { themeId: 't1', signature: 's' } } });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0].brandTheme).toEqual({ themeId: 't1', signature: 's' });
  });
});
