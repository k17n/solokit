import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileForm } from './ProfileForm';
import { emptyProfileForm } from './profileFormState';
import { RED_LOGO, fakePaletteDeps } from './testDeps';

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
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValue(undefined);
    render(<ProfileForm initial={emptyProfileForm('unregistered')} submitLabel="Save" onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Your profile could not be saved. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Storage is full')).not.toBeInTheDocument();
    expect(logged).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Your profile could not be saved. Please try again.')).not.toBeInTheDocument());
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

describe('ProfileForm sections, brand colours and the GST placeholder', () => {
  it('says which tools use each section', () => {
    render(<ProfileForm initial={emptyProfileForm('unregistered')} submitLabel="Save" onSave={vi.fn()} />);
    const details = screen.getByRole('group', { name: 'Business details' });
    expect(details).toHaveTextContent('Used by');
    expect(details).toHaveTextContent('Invoices and quotes');
    expect(details).toHaveTextContent('Contracts');
    const payments = screen.getByRole('group', { name: 'Payment details' });
    expect(payments).toHaveTextContent('Invoices and quotes');
    expect(payments).not.toHaveTextContent('Contracts');
  });

  it('saves typed brand colours as a manual source', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm initial={emptyProfileForm('unregistered')} submitLabel="Save" onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.type(screen.getByLabelText('Accent colour'), '7c2d12');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ brand: { primary: '#7C2D12' }, brandSource: 'manual' });
  });

  it('fills brand colours from the logo with "Use my logo colours" and saves them with the logo as their source', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileForm
        initial={emptyProfileForm('unregistered')}
        submitLabel="Save"
        onSave={onSave}
        processLogo={async () => 'data:image/png;base64,AAAA'}
        brandDeps={fakePaletteDeps(RED_LOGO)}
      />,
    );
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.upload(screen.getByLabelText('Logo'), new File(['x'], 'logo.png', { type: 'image/png' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Use my logo colours' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]?.[0];
    expect(saved.brandSource).toBe('logo');
    expect(saved.brand.primary).toMatch(/^#[0-9A-F]{6}$/);
    expect(saved.logoDataUrl).toBe('data:image/png;base64,AAAA');
  });

  it('rejects a brand colour that is not a colour and focuses it', async () => {
    const onSave = vi.fn();
    render(<ProfileForm initial={emptyProfileForm('unregistered')} submitLabel="Save" onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.type(screen.getByLabelText('Accent colour'), 'blue');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Accent colour')).toHaveFocus());
  });

  it('does not pretend a GST status was chosen while it is only a placeholder, and drops the placeholder once one is chosen', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm initial={{ ...emptyProfileForm('unregistered'), gstUnconfirmed: true }} submitLabel="Save" onSave={onSave} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    expect(screen.queryByText('Check your turnover limit')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ gstUnconfirmed: true });

    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1]?.[0]).not.toHaveProperty('gstUnconfirmed');
  });

  it('keeps the link to the brand theme when saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileForm
        initial={{ ...emptyProfileForm('unregistered'), name: 'Ravi', line1: '4 Park Street', city: 'Kolkata', brandTheme: { themeId: 't1', signature: 's' } }}
        submitLabel="Save"
        onSave={onSave}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0].brandTheme).toEqual({ themeId: 't1', signature: 's' });
  });
});
