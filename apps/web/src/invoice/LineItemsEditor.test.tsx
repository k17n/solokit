import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { emptyLine, type LineDraft } from './editorModel';
import { LineItemsEditor } from './LineItemsEditor';

const regular = makeSeller();
const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });

function Harness({
  initial,
  taxApplies = true,
  issueDate = '2026-10-14',
  errors = {},
  profile = regular,
  currency = 'INR' as const,
}: {
  initial?: LineDraft[];
  taxApplies?: boolean;
  issueDate?: string;
  errors?: Record<string, string>;
  profile?: typeof regular;
  currency?: 'INR' | 'USD';
}) {
  const [lines, setLines] = useState<LineDraft[]>(initial ?? [emptyLine('a', profile)]);
  return (
    <>
      <LineItemsEditor lines={lines} onChange={setLines} taxApplies={taxApplies} currency={currency} issueDate={issueDate} profile={profile} errors={errors} />
      <output aria-label="count">{lines.length}</output>
    </>
  );
}

const item = (n: number) => screen.getByRole('group', { name: `Item ${n}` });

describe('LineItemsEditor fields', () => {
  it('shows the fields of an item, with the GST rate only when GST applies', () => {
    render(<Harness />);
    const first = within(item(1));
    expect(first.getByLabelText('Description')).toBeInTheDocument();
    expect(first.getByLabelText('HSN/SAC code')).toBeInTheDocument();
    expect(first.getByLabelText('Quantity')).toHaveValue('1');
    expect(first.getByLabelText('Unit')).toHaveValue('fixed');
    expect(first.getByLabelText('Rate (₹)')).toBeInTheDocument();
    expect(first.getByLabelText('Discount')).toHaveValue('none');
    expect(first.getByLabelText('GST rate')).toHaveValue('18');
    expect(first.queryByLabelText('Discount value')).not.toBeInTheDocument();
  });

  it('leaves out the GST rate when no GST applies', () => {
    render(<Harness taxApplies={false} profile={unregistered} />);
    expect(within(item(1)).queryByLabelText('GST rate')).not.toBeInTheDocument();
  });

  it('labels the rate with the invoice currency', () => {
    render(<Harness currency="USD" />);
    expect(within(item(1)).getByLabelText('Rate ($)')).toBeInTheDocument();
  });

  it('suggests common SAC codes and says they are not an official register', () => {
    render(<Harness />);
    const input = within(item(1)).getByLabelText('HSN/SAC code');
    const listId = input.getAttribute('list');
    expect(listId).toBeTruthy();
    const options = document.querySelectorAll(`datalist#${CSS.escape(listId as string)} option`);
    expect(options.length).toBeGreaterThan(5);
    expect(input).toHaveAccessibleDescription(/not an official register/);
  });

  it('shows a discount value field once a discount type is chosen', async () => {
    render(<Harness />);
    await userEvent.selectOptions(within(item(1)).getByLabelText('Discount'), 'percent');
    expect(within(item(1)).getByLabelText('Discount value')).toBeInTheDocument();
  });

  it('shows the amount before GST, or says it is not worked out yet', async () => {
    render(<Harness />);
    expect(within(item(1)).getByText('Amount before GST: not worked out yet')).toBeInTheDocument();
    await userEvent.type(within(item(1)).getByLabelText('Rate (₹)'), '3000');
    expect(within(item(1)).getByText('Amount before GST: ₹3,000.00')).toBeInTheDocument();
    await userEvent.clear(within(item(1)).getByLabelText('Quantity'));
    await userEvent.type(within(item(1)).getByLabelText('Quantity'), '24');
    expect(within(item(1)).getByText('Amount before GST: ₹72,000.00')).toBeInTheDocument();
  });

  it('shows the error for each field', () => {
    render(<Harness errors={{ 'lines[0].description': 'Describe what you are charging for', 'lines[0].rate': 'Enter the rate' }} />);
    expect(within(item(1)).getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
    expect(within(item(1)).getByText('Describe what you are charging for')).toBeInTheDocument();
    expect(within(item(1)).getByLabelText('Rate (₹)')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('LineItemsEditor list actions', () => {
  it('adds items and removes them, but never the last one', async () => {
    render(<Harness />);
    expect(within(item(1)).getByRole('button', { name: 'Remove item' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByLabelText('count')).toHaveTextContent('2');
    expect(item(2)).toBeInTheDocument();
    expect(within(item(1)).getByRole('button', { name: 'Remove item' })).toBeEnabled();
    await userEvent.click(within(item(2)).getByRole('button', { name: 'Remove item' }));
    expect(screen.getByLabelText('count')).toHaveTextContent('1');
  });

  it('starts a new item with the usual defaults', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(within(item(2)).getByLabelText('GST rate')).toHaveValue('18');
    expect(within(item(2)).getByLabelText('Quantity')).toHaveValue('1');
  });
});

describe('LineItemsEditor GST rates', () => {
  const rates = () => within(item(1)).getAllByRole('option').map((option) => option.textContent);

  it('offers the current slabs and the special rates, not the retired ones', () => {
    render(<Harness />);
    const options = within(within(item(1)).getByLabelText('GST rate')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['0%', '5%', '18%', '40%', '0.25%', '3%']));
    expect(options.some((label) => label?.includes('12%'))).toBe(false);
    expect(options.some((label) => label?.includes('28%'))).toBe(false);
    expect(rates().length).toBeGreaterThan(0);
  });

  it('offers the old rates for an invoice dated before 22 September 2025', () => {
    render(<Harness issueDate="2025-06-01" />);
    const options = within(within(item(1)).getByLabelText('GST rate')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['12% (old rate)', '28% (old rate)']));
  });

  it('keeps an old rate a line already uses, and warns when the date is after the change', () => {
    render(<Harness initial={[{ ...emptyLine('a', regular), gstRate: '12' }]} />);
    expect(within(item(1)).getByLabelText('GST rate')).toHaveValue('12');
    const warning = within(item(1)).getByRole('status');
    expect(warning).toHaveTextContent('12% was withdrawn on 22 Sep 2025');
    expect(warning).toHaveTextContent('14 Oct 2026');
  });

  it('does not warn about an old rate on an invoice dated before the change', () => {
    render(<Harness issueDate="2025-06-01" initial={[{ ...emptyLine('a', regular), gstRate: '12' }]} />);
    expect(within(item(1)).queryByRole('status')).not.toBeInTheDocument();
  });
});
