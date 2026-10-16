import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { newEditorState, type EditorState } from './editorModel';
import { DetailsSection } from './DetailsSection';

const regular = makeSeller();
const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });
const composition = makeSeller({ gstStatus: 'composition' });

function Harness({
  profile = regular,
  errors = {},
  patch = {},
}: {
  profile?: typeof regular;
  errors?: Record<string, string>;
  patch?: Partial<EditorState>;
}) {
  const [state, setState] = useState<EditorState>({
    ...newEditorState({ invoiceId: 'i', clientId: 'c', lineId: 'l', number: '2026-27/0001', today: '2026-10-14', profile, defaultThemeId: 'classic' }),
    ...patch,
  });
  return (
    <>
      <DetailsSection state={state} onChange={(next) => setState((current) => ({ ...current, ...next }))} profile={profile} themes={[...PRESET_THEMES]} errors={errors} />
      <output aria-label="state">{JSON.stringify({ n: state.number, ne: state.numberEdited, k: state.kind, x: state.isExport, c: state.currency, p: state.placeOfSupplyStateCode, pe: state.placeEdited, rc: state.reverseCharge, ex: state.exemptSupply, tds: state.tdsEnabled, th: state.themeId })}</output>
    </>
  );
}

const current = () => JSON.parse(screen.getByLabelText('state').textContent ?? '{}') as Record<string, unknown>;

describe('DetailsSection: invoice details', () => {
  it('shows the number and dates', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0001');
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-10-14');
    expect(screen.getByLabelText('Due date')).toHaveValue('');
    expect(screen.queryByLabelText('Document type')).not.toBeInTheDocument();
  });

  it('marks the number as typed by hand once it is edited', async () => {
    render(<Harness />);
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'A-1');
    expect(current()).toMatchObject({ n: 'A-1', ne: true });
  });

  it('shows errors on the number and the dates', () => {
    render(<Harness errors={{ number: 'That invoice number is already used.', issueDate: 'Enter a valid issue date' }} />);
    expect(screen.getByLabelText('Invoice number')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Issue date')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('That invoice number is already used.')).toBeInTheDocument();
  });
});

describe('DetailsSection: supply for a regular seller', () => {
  it('shows place of supply, reverse charge and exempt supply for a domestic invoice', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Place of supply')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Reverse charge applies' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Exempt supply (bill of supply)' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument();
  });

  it('records a chosen place of supply as chosen by hand', async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText('Place of supply'), '29');
    expect(current()).toMatchObject({ p: '29', pe: true });
  });

  it('switches to an export: asks for a currency and drops the domestic GST options', async () => {
    render(<Harness patch={{ reverseCharge: true }} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    expect(current()).toMatchObject({ x: true, rc: false });
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Reverse charge applies' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'EUR');
    expect(current().c).toBe('EUR');
  });

  it('turns reverse charge off when the supply becomes exempt', async () => {
    render(<Harness patch={{ reverseCharge: true }} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Exempt supply (bill of supply)' }));
    expect(current()).toMatchObject({ ex: true, rc: false });
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
  });
});

describe('DetailsSection: supply for sellers who charge no GST', () => {
  it('offers only the export choice for an unregistered seller', () => {
    render(<Harness profile={unregistered} />);
    expect(screen.getByRole('checkbox', { name: 'Client is outside India (export)' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Reverse charge applies' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Exempt supply (bill of supply)' })).not.toBeInTheDocument();
  });

  it('offers the same for a composition seller', () => {
    render(<Harness profile={composition} />);
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Exempt supply (bill of supply)' })).not.toBeInTheDocument();
  });
});

describe('DetailsSection: payment, notes and style', () => {
  it('shows the TDS rate only when TDS is switched on', async () => {
    render(<Harness />);
    expect(screen.queryByLabelText('TDS rate (%)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client deducts TDS' }));
    expect(screen.getByLabelText('TDS rate (%)')).toHaveValue('10');
    expect(screen.getByLabelText('TDS rate (%)')).toHaveAccessibleDescription(/Usually 10% for professional fees/);
  });

  it('has an advance field', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Advance already received')).toHaveAccessibleDescription('Subtracted from the amount to pay.');
  });

  it('lists the invoice styles and records the choice', async () => {
    render(<Harness />);
    const select = screen.getByLabelText('Invoice theme');
    const names = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(expect.arrayContaining(['Classic', 'Modern', 'Minimal', 'Bold', 'Consultant', 'Formal']));
    await userEvent.selectOptions(select, 'modern');
    expect(current().th).toBe('modern');
  });

  it('shows notes and terms with their defaults', () => {
    render(<Harness patch={{ notes: 'Thanks', terms: 'Net 15' }} />);
    expect(screen.getByLabelText('Notes')).toHaveValue('Thanks');
    expect(screen.getByLabelText('Terms')).toHaveValue('Net 15');
  });
});

describe('DetailsSection: document types', () => {
  it('shows Valid until and hides due date, TDS, advance and reverse charge for a quotation', () => {
    const { unmount } = render(<Harness />);
    expect(screen.getByLabelText('Reverse charge applies')).toBeInTheDocument();
    unmount();
    render(<Harness patch={{ kind: 'quote', validUntil: '2026-11-13' }} />);
    expect(screen.getByLabelText('Valid until')).toHaveValue('2026-11-13');
    expect(screen.getByLabelText('Quotation number')).toBeInTheDocument();
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reverse charge applies')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Client deducts TDS' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Advance already received')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Place of supply')).toBeInTheDocument();
  });

  it('labels the number for a proforma', () => {
    render(<Harness patch={{ kind: 'proforma' }} />);
    expect(screen.getByLabelText('Proforma number')).toBeInTheDocument();
  });

  it('keeps a valid-until date already chosen and shows its error', async () => {
    render(<Harness patch={{ kind: 'quote', validUntil: '2026-10-01' }} errors={{ validUntil: 'The "valid until" date cannot be before the issue date' }} />);
    expect(screen.getByLabelText('Valid until')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Valid until')).toHaveAttribute('aria-invalid', 'true');
  });
});
