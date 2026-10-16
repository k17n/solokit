import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KindBadge, convertLabel, documentName } from './kinds';

describe('documentName', () => {
  it('names the ordinary document after the seller and the supply', () => {
    expect(documentName('invoice', 'regular')).toBe('Tax invoice');
    expect(documentName('invoice', 'composition')).toBe('Bill of supply');
    expect(documentName('invoice', 'unregistered')).toBe('Invoice');
    expect(documentName('invoice', 'regular', true)).toBe('Bill of supply');
    expect(documentName('invoice')).toBe('Invoice');
  });

  it('names quotations and proformas the same for every seller', () => {
    expect(documentName('quote', 'composition')).toBe('Quotation');
    expect(documentName('proforma', 'unregistered')).toBe('Proforma invoice');
  });
});

describe('convertLabel', () => {
  it('says tax invoice only where the result will be one', () => {
    expect(convertLabel({ kind: 'quote', seller: { gstStatus: 'regular' } })).toBe('Convert to invoice');
    expect(convertLabel({ kind: 'proforma', seller: { gstStatus: 'regular' } })).toBe('Convert to tax invoice');
    expect(convertLabel({ kind: 'proforma', seller: { gstStatus: 'composition' } })).toBe('Convert to bill of supply');
    expect(convertLabel({ kind: 'proforma', seller: { gstStatus: 'unregistered' } })).toBe('Convert to invoice');
  });
});

describe('KindBadge', () => {
  it('shows the name, and hides the code from assistive technology', () => {
    render(<KindBadge kind="quote" />);
    expect(screen.getByText('Quotation')).toBeInTheDocument();
    expect(screen.getByText('QT')).toHaveAttribute('aria-hidden', 'true');
  });
});
