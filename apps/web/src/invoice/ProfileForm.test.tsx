import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileForm } from './ProfileForm';
import { emptyProfileForm } from './profileFormState';

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
