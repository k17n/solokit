import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractKind } from '@solokit/tool-contract';
import { ContractEditor, type ContractEditorProps } from './ContractEditor';
import { NOW, fakeExporter, makeStorage, type TestStorage } from './testSetup';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview-1');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.clearAllMocks());

async function setup({ kind = 'nda-mutual', profile = true, extra = {} }: { kind?: ContractKind; profile?: boolean; extra?: Partial<ContractEditorProps> } = {}) {
  const storage: TestStorage = await makeStorage({ profile });
  const onBack = vi.fn();
  const view = render(
    <ContractEditor
      storage={storage.contracts}
      invoice={storage.invoice}
      initialKind={kind}
      onBack={onBack}
      onFinalised={vi.fn()}
      exporter={fakeExporter()}
      now={() => NOW}
      {...extra}
    />,
  );
  await screen.findByRole('heading', { level: 3, name: /Parties/ });
  return { ...storage, onBack, view };
}

const party = (number: 1 | 2) => within(screen.getByRole('group', { name: new RegExp(`^Party ${number}:`) }));

describe('ContractEditor: which side are you? (one-way NDA)', () => {
  it('does not guess: with a profile, neither side is filled in until the person chooses', async () => {
    await setup({ kind: 'nda-one-way' });
    expect(screen.getByRole('group', { name: 'Which side are you?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Disclosing Party You share/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /^Receiving Party You receive/ })).not.toBeChecked();
    expect(party(1).getByLabelText('Disclosing Party: full name')).toHaveValue('');
    expect(party(2).getByLabelText('Receiving Party: full name')).toHaveValue('');
  });

  it('fills the Disclosing Party from the profile when the person discloses', async () => {
    await setup({ kind: 'nda-one-way' });
    await userEvent.click(screen.getByRole('radio', { name: /^Disclosing Party You share/ }));
    expect(party(1).getByLabelText('Disclosing Party: full name')).toHaveValue('Asha Rao Consulting');
    expect(party(2).getByLabelText('Receiving Party: full name')).toHaveValue('');
    expect(screen.getByRole('radio', { name: /^Disclosing Party You share/ })).toBeChecked();
  });

  it('fills the Receiving Party when the person receives, and moves the details if they change their mind', async () => {
    await setup({ kind: 'nda-one-way' });
    await userEvent.click(screen.getByRole('radio', { name: /^Receiving Party You receive/ }));
    expect(party(2).getByLabelText('Receiving Party: full name')).toHaveValue('Asha Rao Consulting');
    expect(party(1).getByLabelText('Disclosing Party: full name')).toHaveValue('');
    await userEvent.type(party(2).getByLabelText("Signatory's name"), 'Asha Rao');
    await userEvent.click(screen.getByRole('radio', { name: /^Disclosing Party You share/ }));
    expect(party(1).getByLabelText('Disclosing Party: full name')).toHaveValue('Asha Rao Consulting');
    expect(party(1).getByLabelText("Signatory's name")).toHaveValue('Asha Rao');
    expect(party(2).getByLabelText('Receiving Party: full name')).toHaveValue('');
  });

  it('does not ask when there is no profile to fill in from, and does not ask for the other kinds', async () => {
    await setup({ kind: 'nda-one-way', profile: false });
    expect(screen.queryByRole('group', { name: 'Which side are you?' })).not.toBeInTheDocument();
  });

  it('still starts a mutual NDA and a services agreement with the profile on the first party', async () => {
    const mutual = await setup({ kind: 'nda-mutual' });
    expect(screen.queryByRole('group', { name: 'Which side are you?' })).not.toBeInTheDocument();
    expect(party(1).getByLabelText('First Party: full name')).toHaveValue('Asha Rao Consulting');
    mutual.view.unmount();
    await setup({ kind: 'services' });
    expect(party(1).getByLabelText('Freelancer: full name')).toHaveValue('Asha Rao Consulting');
  });
});

describe('ContractEditor: swap parties', () => {
  it.each(['nda-mutual', 'nda-one-way', 'services'] as const)('swaps the two sides of a %s', async (kind) => {
    await setup({ kind });
    const firstName = party(1).getAllByRole('textbox')[0]!;
    const secondName = party(2).getAllByRole('textbox')[0]!;
    await userEvent.type(secondName, 'Northwind Traders');
    const before = [(firstName as HTMLInputElement).value, 'Northwind Traders'];
    await userEvent.click(screen.getByRole('button', { name: 'Swap parties' }));
    expect((party(1).getAllByRole('textbox')[0] as HTMLInputElement).value).toBe(before[1]);
    expect((party(2).getAllByRole('textbox')[0] as HTMLInputElement).value).toBe(before[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Swap parties' }));
    expect((party(1).getAllByRole('textbox')[0] as HTMLInputElement).value).toBe(before[0]);
  });

  it('keeps the "which side" choice in step with a swap', async () => {
    await setup({ kind: 'nda-one-way' });
    await userEvent.click(screen.getByRole('radio', { name: /^Disclosing Party You share/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Swap parties' }));
    expect(screen.getByRole('radio', { name: /^Receiving Party You receive/ })).toBeChecked();
    expect(party(2).getByLabelText('Receiving Party: full name')).toHaveValue('Asha Rao Consulting');
  });

  it('counts a swap as an unsaved change', async () => {
    await setup({ kind: 'services' });
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Swap parties' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });
});

describe('ContractEditor: characters the PDF cannot print', () => {
  it('shows a warning, not an error, naming the characters', async () => {
    await setup({ kind: 'nda-mutual' });
    expect(screen.queryByText('Some characters will not print in the PDF')).not.toBeInTheDocument();
    await userEvent.type(party(2).getByLabelText('Second Party: full name'), 'アシャ Traders');
    const warning = (await screen.findByText('Some characters will not print in the PDF')).closest('[role]') ?? document.body;
    expect(warning).toHaveTextContent('Party 2: Some characters (ア シ ャ) will not print in the PDF; the Word version will show them.');
    // It is only a warning: nothing is reported as a problem to fix.
    expect(screen.queryByText(/Fix \d+ things? before/)).not.toBeInTheDocument();
  });

  it('goes away when the characters are removed', async () => {
    await setup({ kind: 'nda-mutual' });
    const name = party(2).getByLabelText('Second Party: full name');
    await userEvent.type(name, '日本');
    await screen.findByText('Some characters will not print in the PDF');
    await userEvent.clear(name);
    await waitFor(() => expect(screen.queryByText('Some characters will not print in the PDF')).not.toBeInTheDocument());
  });
});

describe('ContractEditor: sections stay as the reader left them', () => {
  it('keeps the tax numbers section open when the numbers are cleared', async () => {
    await setup({ kind: 'nda-mutual' });
    const summary = party(2).getByText('Tax and company numbers (optional)');
    const details = summary.closest('details')!;
    expect(details).not.toHaveAttribute('open');
    await userEvent.click(summary);
    expect(details).toHaveAttribute('open');
    const pan = party(2).getByLabelText('PAN');
    await userEvent.type(pan, 'ABCDE1234F');
    await userEvent.clear(pan);
    expect(party(2).getByLabelText('PAN')).toBeVisible();
    expect(details).toHaveAttribute('open');
  });

  it('stays closed when the reader closed it, even while the numbers are filled in', async () => {
    await setup({ kind: 'nda-mutual' });
    const summary = party(2).getByText('Tax and company numbers (optional)');
    const details = summary.closest('details')!;
    await userEvent.click(summary);
    await userEvent.type(party(2).getByLabelText('PAN'), 'ABCDE1234F');
    await userEvent.click(summary);
    await waitFor(() => expect(details).not.toHaveAttribute('open'));
    expect(details).not.toHaveAttribute('open');
  });

  it('opens by itself when a field inside has an error, and does not close again once fixed', async () => {
    await setup({ kind: 'nda-mutual' });
    const summary = party(2).getByText('Tax and company numbers (optional)');
    const details = summary.closest('details')!;
    await userEvent.type(party(2).getByLabelText('Second Party: full name'), 'Northwind');
    await userEvent.click(summary);
    await userEvent.type(party(2).getByLabelText('PAN'), 'BAD');
    await userEvent.click(summary); // the reader closes it with a bad PAN inside
    await waitFor(() => expect(details).not.toHaveAttribute('open'));
    await userEvent.click(screen.getByRole('button', { name: 'Finalise agreement' }));
    // The attempt reports the problem, which opens the section so the field can be seen.
    await waitFor(() => expect(details).toHaveAttribute('open'));
    const pan = party(2).getByLabelText('PAN');
    await userEvent.clear(pan);
    await userEvent.type(pan, 'ABCDE1234F');
    expect(details).toHaveAttribute('open');
  });

  it('keeps "Other settings" open while its fields are changed', async () => {
    await setup({ kind: 'nda-mutual' });
    const terms = within(screen.getByRole('region', { name: /Key terms/ }));
    const summary = terms.getByText(/Other settings \(\d+ topics\)/);
    await userEvent.click(summary);
    const months = terms.getByLabelText('How long information can be shared (months)');
    await userEvent.type(months, '99');
    await userEvent.clear(months);
    expect(summary.closest('details')).toHaveAttribute('open');
  });
});

describe('ContractEditor: unsaved changes', () => {
  it('asks the browser to confirm before the page closes while there are unsaved changes', async () => {
    await setup();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await userEvent.type(party(2).getByLabelText('Second Party: full name'), 'Northwind');
    expect(unload()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(unload()).toBe(false);
  });

  it('stops asking once the editor is closed', async () => {
    const { view } = await setup();
    await userEvent.type(party(2).getByLabelText('Second Party: full name'), 'Northwind');
    view.unmount();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('reports whether it holds unsaved changes to the app around it', async () => {
    const onDirtyChange = vi.fn();
    await setup({ extra: { onDirtyChange } });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await userEvent.type(party(2).getByLabelText('Second Party: full name'), 'N');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('asks what to do with unsaved changes when the app asks to leave, and tells the app if the person stays', async () => {
    const onStay = vi.fn();
    const storage = await makeStorage();
    const props = { storage: storage.contracts, invoice: storage.invoice, initialKind: 'nda-mutual' as const, onBack: vi.fn(), onFinalised: vi.fn(), exporter: fakeExporter(), now: () => NOW, onStay };
    const { rerender } = render(<ContractEditor {...props} leaveRequest={0} />);
    await screen.findByRole('heading', { level: 3, name: /Parties/ });
    await userEvent.type(party(2).getByLabelText('Second Party: full name'), 'Northwind');
    rerender(<ContractEditor {...props} leaveRequest={1} />);
    expect(await screen.findByText('You have changes that are not saved.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('You have changes that are not saved.')).not.toBeInTheDocument();
    rerender(<ContractEditor {...props} leaveRequest={2} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
