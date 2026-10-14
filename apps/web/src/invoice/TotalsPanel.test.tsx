import { render, screen, within } from '@testing-library/react';
import { buildInvoiceDocument } from '@solokit/tool-invoice';
import { makeInvoice } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { TotalsPanel } from './TotalsPanel';

describe('TotalsPanel', () => {
  it('asks for the details when there is nothing to show yet', () => {
    render(<TotalsPanel document={null} />);
    expect(screen.getByRole('heading', { name: 'Totals' })).toBeInTheDocument();
    expect(screen.getByText('Fill in the details above to see the totals.')).toBeInTheDocument();
  });

  it('lists the totals, the amount in words and the declarations', () => {
    const document = buildInvoiceDocument(makeInvoice({ tds: { ratePercent: 10 } }));
    render(<TotalsPanel document={document} />);
    const list = screen.getByRole('list', { name: 'Totals' });
    const labels = within(list).getAllByRole('listitem').map((item) => item.textContent);
    expect(labels.some((text) => text?.includes('Taxable value') && text.includes('₹72,000.00'))).toBe(true);
    expect(labels.some((text) => text?.includes('CGST @9%') && text.includes('₹6,480.00'))).toBe(true);
    expect(labels.some((text) => text?.includes('Total') && text.includes('₹84,960.00'))).toBe(true);
    expect(labels.some((text) => text?.includes('Net payable') && text.includes('₹77,760.00'))).toBe(true);
    expect(screen.getByText('Eighty-Four Thousand Nine Hundred Sixty Rupees Only')).toBeInTheDocument();
    expect(screen.getByText(/TDS at 10% is expected to be deducted by the client/)).toBeInTheDocument();
  });
});
