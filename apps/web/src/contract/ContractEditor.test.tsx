import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractKind } from '@solokit/tool-contract';
import { downloadBlob } from '../invoice/downloads';
import { ContractEditor } from './ContractEditor';
import { NOW, fakeExporter, makeClient, makeStorage, seedDraft, type TestStorage } from './testSetup';

vi.mock('../invoice/downloads', () => ({ downloadBlob: vi.fn() }));

const urls = { create: vi.fn(() => 'blob:preview-1'), revoke: vi.fn() };
beforeEach(() => {
  URL.createObjectURL = urls.create;
  URL.revokeObjectURL = urls.revoke;
});
afterEach(() => vi.clearAllMocks());

interface Options {
  kind?: ContractKind;
  contractId?: string;
  profile?: boolean;
  seed?: (storage: TestStorage) => Promise<void>;
}

async function setup({ kind = 'nda-mutual', contractId, profile = true, seed }: Options = {}) {
  const storage = await makeStorage({ profile });
  await seed?.(storage);
  const onBack = vi.fn();
  const onFinalised = vi.fn();
  const exporter = fakeExporter();
  render(
    <ContractEditor
      storage={storage.contracts}
      invoice={storage.invoice}
      contractId={contractId}
      initialKind={kind}
      onBack={onBack}
      onFinalised={onFinalised}
      exporter={exporter}
      now={() => NOW}
    />,
  );
  await screen.findByRole('heading', { level: 3, name: /Parties/ });
  return { ...storage, onBack, onFinalised, exporter };
}

const party = (number: 1 | 2) => within(screen.getByRole('group', { name: new RegExp(`^Party ${number}:`) }));

describe('ContractEditor: sections', () => {
  it('has five numbered sections and a way to jump between them', async () => {
    await setup();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['1Parties', '2Key terms', '3Optional clauses', '4Jurisdiction and stamp duty', '5Review']);
    const nav = within(screen.getByRole('navigation', { name: 'Sections of this agreement' }));
    expect(nav.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['#sec-parties', '#sec-terms', '#sec-clauses', '#sec-jurisdiction', '#sec-review']);
    expect(screen.getByRole('heading', { level: 2, name: 'New mutual nda' })).toBeInTheDocument();
  });

  it('starts the first party from the business profile and leaves the signatory to the user', async () => {
    await setup({ kind: 'services' });
    expect(party(1).getByLabelText('Freelancer: full name')).toHaveValue('Asha Rao Consulting');
    expect(party(1).getByLabelText('City', { exact: true })).toHaveValue('Mumbai');
    expect(party(1).getByLabelText("Signatory's name")).toHaveValue('');
    expect(party(2).getByLabelText('Client: full name')).toHaveValue('');
    expect(screen.queryByText('Save your details once')).not.toBeInTheDocument();
  });

  it('points to the business setup, coming back here, when there is no profile yet', async () => {
    await setup({ profile: false });
    expect(screen.getByText('Save your details once')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'business details' })).toHaveAttribute('href', '/app/setup/?next=%2Fapp%2Fcontract%2F');
    expect(screen.queryByText(/invoice tool/)).not.toBeInTheDocument();
    expect(party(1).getByLabelText('First Party: full name')).toHaveValue('');
  });

  it('fills a party from a saved client', async () => {
    await setup({ seed: async ({ invoice }) => void (await invoice.clients.save(makeClient({ id: 'c9', name: 'Acme Co', email: 'hello@acme.example' }))) });
    await userEvent.selectOptions(party(2).getByLabelText('Fill in the Second Party from saved details'), 'Acme Co');
    expect(party(2).getByLabelText('Second Party: full name')).toHaveValue('Acme Co');
    expect(party(2).getByLabelText('Email for notices')).toHaveValue('hello@acme.example');
  });

  it('asks for the purpose of an NDA and tucks the defaulted settings away', async () => {
    await setup();
    const terms = within(screen.getByRole('region', { name: /Key terms/ }));
    expect(terms.getByLabelText(/Purpose of sharing the information/)).toBeRequired();
    const other = terms.getByText(/Other settings \(\d+ topics\)/);
    expect(other.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(other);
    const months = terms.getByLabelText('How long information can be shared (months)');
    expect(months).toHaveValue('');
    expect(months).toHaveAccessibleDescription(/template default: 24 months/);
    expect(months).toHaveAccessibleDescription(/Between 1 and 120 months/);
  });

  it('shows fee fields for the chosen fee model, and milestones when that is chosen', async () => {
    await setup({ kind: 'services' });
    const terms = within(screen.getByRole('region', { name: /Key terms/ }));
    // The fee model has no default, so no fee field shows until one is chosen.
    expect(terms.queryByLabelText('Fixed fee (INR)')).not.toBeInTheDocument();
    await userEvent.click(terms.getByRole('radio', { name: /One fixed fee/ }));
    expect(terms.getByLabelText('Fixed fee (INR)')).toBeInTheDocument();
    expect(terms.queryByLabelText('Hourly rate (INR)')).not.toBeInTheDocument();
    await userEvent.click(terms.getByRole('radio', { name: /Hourly rate/ }));
    expect(terms.getByLabelText('Hourly rate (INR)')).toBeInTheDocument();
    expect(terms.queryByLabelText('Fixed fee (INR)')).not.toBeInTheDocument();
    await userEvent.click(terms.getByRole('radio', { name: /Fees per milestone/ }));
    expect(terms.queryByLabelText('Hourly rate (INR)')).not.toBeInTheDocument();
    await userEvent.click(terms.getByRole('button', { name: 'Add a milestone' }));
    await userEvent.type(terms.getByLabelText('Milestone name'), 'Design approved');
    await userEvent.type(terms.getByLabelText('Amount (INR)'), '40000');
    await userEvent.type(terms.getByLabelText('Due when'), 'on approval');
    await userEvent.click(terms.getByRole('button', { name: 'Add a milestone' }));
    expect(terms.getAllByRole('group', { name: /Milestone \d/ })).toHaveLength(2);
    expect(terms.getByText('Total of the milestones: INR 40,000')).toBeInTheDocument();
    await userEvent.click(terms.getByRole('button', { name: 'Remove milestone 2' }));
    expect(terms.getAllByRole('group', { name: /Milestone \d/ })).toHaveLength(1);
  }, 30_000);

  it('marks the template default among the choices', async () => {
    await setup({ kind: 'services' });
    const terms = within(screen.getByRole('region', { name: /Key terms/ }));
    await userEvent.click(terms.getByText(/Other settings/));
    expect(terms.getAllByText('Template default').length).toBeGreaterThan(3);
  });

  it('lets the user switch optional clauses and explains each', async () => {
    await setup();
    const clauses = within(screen.getByRole('region', { name: /Optional clauses/ }));
    const toggles = clauses.getAllByRole('checkbox');
    expect(toggles.length).toBeGreaterThanOrEqual(2);
    const first = toggles[0]!;
    const before = (first as HTMLInputElement).checked;
    await userEvent.click(first);
    expect((first as HTMLInputElement).checked).toBe(!before);
    const why = clauses.getAllByText('Why this is here', { selector: 'summary' })[0]!.closest('details')!;
    expect(why).not.toHaveAttribute('open');
    await userEvent.click(why.querySelector('summary')!);
    expect(why).toHaveAttribute('open');
    expect(clauses.getByText(/Clauses that are always included/)).toBeInTheDocument();
  });

  it('shows the stamp duty note for the chosen state without any amount', async () => {
    await setup();
    const section = within(screen.getByRole('region', { name: /Jurisdiction and stamp duty/ }));
    expect(section.getByText('Stamp duty: check for your state')).toBeInTheDocument();
    await userEvent.selectOptions(section.getByLabelText('State', { exact: true }), 'Karnataka');
    expect(section.getByText('Stamp duty: check for Karnataka')).toBeInTheDocument();
    expect(section.getByText(/Verify for Karnataka/)).toBeInTheDocument();
    expect(section.getByText(/does not hold amounts/)).toBeInTheDocument();
  });
});

describe('ContractEditor: problems', () => {
  it('shows no errors until the first attempt, then lists them and focuses the first invalid field', async () => {
    await setup({ profile: false });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finalise agreement' }));
    const summary = await screen.findByText(/Fix \d+ things before you finalise or download this agreement/);
    expect(summary).toBeInTheDocument();
    const list = summary.closest('[role="alert"]') as HTMLElement;
    expect(within(list).getAllByText('Parties: Enter the name of this party', { selector: 'li' })).toHaveLength(2);
    expect(within(list).getByText(/Key terms: Fill in: Purpose of sharing the information/)).toBeInTheDocument();
    expect(within(list).getByText(/Jurisdiction: Choose the city/)).toBeInTheDocument();
    await waitFor(() => expect(party(1).getByLabelText('First Party: full name')).toHaveFocus());
    expect(party(1).getByLabelText('First Party: full name')).toBeInvalid();
    // Fixing a field clears its message as the user types.
    await userEvent.type(party(1).getByLabelText('First Party: full name'), 'Asha');
    expect(party(1).getByLabelText('First Party: full name')).toBeValid();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('flags a number that is not a number, and a value outside its range', async () => {
    await setup();
    await userEvent.click(screen.getByText(/Other settings/));
    const months = screen.getByLabelText('How long information can be shared (months)');
    await userEvent.type(months, '2x');
    await userEvent.click(screen.getByRole('button', { name: 'Finalise agreement' }));
    expect(await screen.findAllByText(/must be a whole number/)).not.toHaveLength(0);
    await userEvent.clear(months);
    await userEvent.type(months, '500');
    expect(await screen.findAllByText(/must be at most 120/)).not.toHaveLength(0);
  });

  it('does not finalise or export an incomplete agreement', async () => {
    const { exporter, contracts } = await setup({ profile: false });
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(exporter).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(screen.queryByText(/Finalise this agreement\?/)).not.toBeInTheDocument();
    expect(await contracts.list()).toHaveLength(0);
  });
});

describe('ContractEditor: saving', () => {
  it('saves a draft with a suggested name and says so', async () => {
    const { contracts } = await setup({ profile: false });
    await userEvent.type(party(2).getByLabelText('Second Party: full name'), 'Northwind');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    const [saved] = await contracts.list();
    expect(saved).toMatchObject({ title: 'Mutual NDA with Northwind', status: 'draft', kind: 'nda-mutual', effectiveDate: '2026-10-16' });
    expect(saved?.parties[1]?.name).toBe('Northwind');
  });

  it('opens an existing draft and keeps the values', async () => {
    await setup({ kind: 'services', contractId: 'draft-services', seed: async ({ contracts }) => void (await seedDraft(contracts)) });
    expect(screen.getByRole('heading', { level: 2, name: 'Edit draft' })).toBeInTheDocument();
    expect(screen.getByLabelText('Agreement name')).toHaveValue('Draft services');
    expect(screen.getByLabelText('Fixed fee (INR)')).toHaveValue('120000');
    expect(party(2).getByLabelText('Client: full name')).toHaveValue('Northwind Traders Private Limited');
  });

  it('refuses to edit a final agreement', async () => {
    const storage = await makeStorage();
    const saved = await seedDraft(storage.contracts);
    await storage.contracts.finalise(saved.id);
    render(<ContractEditor storage={storage.contracts} invoice={storage.invoice} contractId={saved.id} onBack={vi.fn()} onFinalised={vi.fn()} />);
    expect(await screen.findByText('This agreement cannot be edited')).toBeInTheDocument();
  });

  it('asks before leaving with unsaved changes', async () => {
    const { onBack, contracts } = await setup({ profile: false });
    await userEvent.click(screen.getByRole('button', { name: 'Back to agreements' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await userEvent.type(party(1).getByLabelText('First Party: full name'), 'Asha');
    await userEvent.click(screen.getByRole('button', { name: 'Back to agreements' }));
    expect(screen.getByText('You have changes that are not saved.')).toHaveFocus();
    expect(onBack).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to agreements' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft and leave' }));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(2));
    expect(await contracts.list()).toHaveLength(1);
  });
});

describe('ContractEditor: finalising', () => {
  const complete = { kind: 'services' as const, contractId: 'draft-services', seed: async ({ contracts }: TestStorage) => void (await seedDraft(contracts)) };

  it('explains what Finalise does, and finalises only after confirmation', async () => {
    const { contracts, onFinalised } = await setup(complete);
    await userEvent.click(screen.getByRole('button', { name: 'Finalise agreement' }));
    const question = screen.getByText(/Finalise this agreement\? Its wording is locked/);
    expect(question).toHaveFocus();
    expect(question).toHaveTextContent('use Reopen to edit it again');
    expect((await contracts.get('draft-services'))?.status).toBe('draft');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, finalise' }));
    await waitFor(() => expect(onFinalised).toHaveBeenCalledWith('draft-services'));
    const final = await contracts.get('draft-services');
    expect(final?.status).toBe('final');
    expect(final?.finalDocument?.clauses.length).toBeGreaterThan(5);
  });

  it('Keep editing cancels and returns focus to Finalise', async () => {
    const { contracts, onFinalised } = await setup(complete);
    await userEvent.click(screen.getByRole('button', { name: 'Finalise agreement' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finalise agreement' })).toHaveFocus());
    expect(onFinalised).not.toHaveBeenCalled();
    expect((await contracts.get('draft-services'))?.status).toBe('draft');
  });
});

describe('ContractEditor: exports and preview', () => {
  const complete = { kind: 'services' as const, contractId: 'draft-services', seed: async ({ contracts }: TestStorage) => void (await seedDraft(contracts)) };

  it('wires each download button to the exporter and the browser download', async () => {
    const { exporter } = await setup(complete);
    const cases: [string, string][] = [
      ['Download PDF', 'pdf'],
      ['Download Word', 'docx'],
      ['Download review pack', 'review-pdf'],
      ['Review pack as Word', 'review-docx'],
    ];
    for (const [label, kind] of cases) {
      await userEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(exporter).toHaveBeenLastCalledWith(kind, expect.objectContaining({ contract: expect.objectContaining({ id: 'draft-services' }) })));
    }
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(4));
    expect(downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'draft-services-review-docx');
  });

  it('says so when a download cannot be built', async () => {
    const { exporter } = await setup(complete);
    exporter.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText('The document could not be built. Try again.')).toBeInTheDocument();
  });

  it('builds the preview only when asked, shows it in a frame and frees the blob address when hidden', async () => {
    const { exporter } = await setup(complete);
    expect(exporter).not.toHaveBeenCalled();
    const toggle = screen.getByRole('button', { name: 'Show preview' });
    await userEvent.click(toggle);
    expect(await screen.findByTitle('Agreement preview', undefined, { timeout: 3000 })).toHaveAttribute('src', 'blob:preview-1');
    expect(exporter).toHaveBeenCalledWith('pdf', expect.anything());
    expect(screen.getByRole('link', { name: 'Open preview in a new tab' })).toHaveAttribute('href', 'blob:preview-1');
    await userEvent.click(screen.getByRole('button', { name: 'Hide preview' }));
    expect(screen.queryByTitle('Agreement preview')).not.toBeInTheDocument();
    expect(urls.revoke).toHaveBeenCalledWith('blob:preview-1');
  });

  it('shows the review summary once the agreement is complete', async () => {
    await setup(complete);
    expect(screen.getByRole('heading', { name: 'Defaults you did not change' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Questions for your lawyer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your key choices' })).toBeInTheDocument();
    expect(screen.getAllByText('Template, not legal advice').length).toBeGreaterThanOrEqual(2);
  });

  it('asks for the missing details instead of a preview while the agreement is incomplete', async () => {
    await setup({ profile: false });
    expect(screen.getByText('The preview and summary appear when sections 1 to 4 are complete')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Questions for your lawyer' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show preview' }));
    expect(screen.getByText('Fill in the details to see the preview.')).toBeInTheDocument();
  });
});
