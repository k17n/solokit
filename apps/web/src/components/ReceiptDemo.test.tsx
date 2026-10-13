import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReceiptDemo } from './ReceiptDemo';

describe('ReceiptDemo', () => {
  it('starts with a worked example', () => {
    render(<ReceiptDemo />);
    expect(screen.getByLabelText('Amount before GST')).toHaveValue('1,00,000');
    expect(screen.getByText('CGST 9%')).toBeInTheDocument();
    expect(screen.getByText('SGST 9%')).toBeInTheDocument();
    expect(screen.getByText('₹1,18,000.00')).toBeInTheDocument();
    expect(screen.getByText('One Lakh Eighteen Thousand Rupees Only')).toBeInTheDocument();
  });

  it('recalculates as you type', async () => {
    render(<ReceiptDemo />);
    const input = screen.getByLabelText('Amount before GST');
    await userEvent.clear(input);
    await userEvent.type(input, '50000');
    expect(screen.getByText('₹59,000.00')).toBeInTheDocument();
    expect(screen.getByText('Fifty-Nine Thousand Rupees Only')).toBeInTheDocument();
  });

  it('switches to IGST for a buyer in another state', async () => {
    render(<ReceiptDemo />);
    await userEvent.click(screen.getByRole('radio', { name: 'Buyer in another state' }));
    expect(screen.getByText('IGST 18%')).toBeInTheDocument();
    expect(screen.queryByText('CGST 9%')).not.toBeInTheDocument();
  });

  it('asks for a valid amount instead of showing nonsense', async () => {
    render(<ReceiptDemo />);
    const input = screen.getByLabelText('Amount before GST');
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    expect(screen.getByText('Enter an amount like 1,00,000')).toBeInTheDocument();
    expect(screen.queryByText(/Rupees Only/)).not.toBeInTheDocument();
  });

  it('is labelled as an example, not a real invoice', () => {
    render(<ReceiptDemo />);
    expect(screen.getByText('Example')).toBeInTheDocument();
  });
});
