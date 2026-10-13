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
