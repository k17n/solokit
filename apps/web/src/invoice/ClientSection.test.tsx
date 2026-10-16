import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { makeClient } from '@solokit/tool-invoice/testing';
import { describe, expect, it, vi } from 'vitest';
import { clientToForm, emptyClientForm, type ClientFormState } from './clientFormState';
import { ClientSection } from './ClientSection';

function Harness({
  isExport = false,
  saved = [makeClient({ id: 'c1', name: 'Northwind Traders' }), makeClient({ id: 'c2', name: 'Acme Co' })],
  errors = {},
  onSelect = () => {},
  initial = emptyClientForm(),
}: {
  isExport?: boolean;
  saved?: ReturnType<typeof makeClient>[];
  errors?: Record<string, string>;
  onSelect?: (client: ReturnType<typeof makeClient> | null) => void;
  initial?: ClientFormState;
}) {
  const [value, setValue] = useState(initial);
  const [save, setSave] = useState(true);
  const [clientId, setClientId] = useState('c-new');
  return (
    <ClientSection
      value={value}
      clientId={clientId}
      savedClients={saved}
      isExport={isExport}
      saveClient={save}
      errors={errors}
      onChange={setValue}
      onSelectClient={(client) => {
        onSelect(client);
        setClientId(client ? client.id : 'c-new');
        setValue(client ? clientToForm(client) : emptyClientForm());
      }}
      onSaveClientChange={setSave}
    />
  );
}

describe('ClientSection (domestic)', () => {
  it('hides the client picker when there are no saved clients', () => {
    render(<Harness saved={[]} />);
    expect(screen.queryByLabelText('Client')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Client name')).toBeInTheDocument();
  });

  it('offers saved clients and a New client choice', () => {
    render(<Harness />);
    const select = screen.getByLabelText('Client');
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'New client' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Northwind Traders' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument();
  });

  it('shows the domestic fields and hides the export ones', () => {
    render(<Harness />);
    for (const label of ['Client name', 'Client GSTIN', 'Address line 1', 'Address line 2', 'City', 'PIN code', 'State', 'Email', 'Phone']) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Country')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Client GSTIN')).toHaveAccessibleDescription('Leave empty if your client is not registered for GST.');
  });

  it('fills the form when a saved client is chosen, and clears it for New client', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c1');
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }));
    expect(screen.getByLabelText('Client name')).toHaveValue('Northwind Traders');
    expect(screen.getByLabelText('Client')).toHaveValue('c1');
    await userEvent.selectOptions(screen.getByLabelText('Client'), '');
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(screen.getByLabelText('Client name')).toHaveValue('');
  });

  it('fills the state from a valid GSTIN', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Client GSTIN'), '29aagcb7383j1z4');
    expect(screen.getByLabelText('Client GSTIN')).toHaveValue('29AAGCB7383J1Z4');
    expect(screen.getByLabelText('State')).toHaveValue('29');
  });

  it('shows errors on the right fields', () => {
    render(<Harness errors={{ 'client.name': 'Enter the client name', 'client.address.city': "Enter the client's city" }} />);
    expect(screen.getByLabelText('Client name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('City')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter the client name')).toBeInTheDocument();
  });

  it('lets the user choose whether to save the client', async () => {
    render(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Save this client for next time' });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(box).not.toBeChecked();
  });
});

describe('ClientSection (export)', () => {
  it('asks for a country instead of a GSTIN and a state', () => {
    render(<Harness isExport />);
    expect(screen.getByLabelText('Country')).toBeInTheDocument();
    expect(screen.queryByLabelText('Client GSTIN')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('State')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Address line 1')).toBeInTheDocument();
  });
});
