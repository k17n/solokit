import { makeClient } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import {
  applyClientGstin,
  clientToForm,
  emptyClientForm,
  formToClient,
  isBlankClient,
  validateClientForm,
  type ClientFormState,
} from './clientFormState';

const filled = (overrides: Partial<ClientFormState> = {}): ClientFormState => ({
  ...emptyClientForm(),
  name: '  Northwind Traders ',
  gstin: '27aabct3518q1zw',
  line1: '4 MG Road',
  city: 'Pune',
  postalCode: '411001',
  stateCode: '27',
  email: 'Accounts@Northwind.example ',
  ...overrides,
});

describe('emptyClientForm', () => {
  it('starts blank and in India', () => {
    const form = emptyClientForm();
    expect(form.country).toBe('India');
    expect(form.name).toBe('');
    expect(isBlankClient(form)).toBe(true);
  });
});

describe('formToClient', () => {
  it('normalises what was typed and keeps the id', () => {
    const client = formToClient(filled(), 'client-9');
    expect(client).toMatchObject({
      id: 'client-9',
      name: 'Northwind Traders',
      gstin: '27AABCT3518Q1ZW',
      email: 'accounts@northwind.example',
      address: { line1: '4 MG Road', city: 'Pune', postalCode: '411001', stateCode: '27', country: 'India' },
    });
    expect('line2' in client.address).toBe(false);
    expect('phone' in client).toBe(false);
  });

  it('round-trips a saved client', () => {
    const saved = makeClient();
    expect(formToClient(clientToForm(saved), saved.id)).toEqual(saved);
  });
});

describe('validateClientForm', () => {
  it('accepts a complete domestic client', () => {
    expect(validateClientForm(filled())).toEqual([]);
  });

  it('accepts a foreign client without a GSTIN or state', () => {
    const form = filled({ gstin: '', stateCode: '', country: 'United States', city: 'Austin', line1: '1 Main St' });
    expect(validateClientForm(form)).toEqual([]);
  });

  it('asks for the name, address line 1 and city', () => {
    const paths = validateClientForm(emptyClientForm()).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'address.line1', 'address.city']));
  });

  it('checks the GSTIN and email', () => {
    const paths = validateClientForm(filled({ gstin: '27AABCT3518Q1ZX', email: 'nope' })).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['gstin', 'email']));
  });
});

describe('applyClientGstin', () => {
  it('upper-cases the typed GSTIN', () => {
    expect(applyClientGstin(emptyClientForm(), ' 27aab ').gstin).toBe('27AAB');
  });

  it('fills the state and India from a valid GSTIN only', () => {
    const valid = applyClientGstin({ ...emptyClientForm(), country: 'France' }, '29AAGCB7383J1Z4');
    expect(valid.stateCode).toBe('29');
    expect(valid.country).toBe('India');
    const partial = applyClientGstin({ ...emptyClientForm(), stateCode: '07' }, '29AAGC');
    expect(partial.stateCode).toBe('07');
  });
});

describe('isBlankClient', () => {
  it('is blank only when name, address line 1 and city are all empty', () => {
    expect(isBlankClient({ ...emptyClientForm(), email: 'x@y.z' })).toBe(true);
    expect(isBlankClient({ ...emptyClientForm(), name: 'A' })).toBe(false);
    expect(isBlankClient({ ...emptyClientForm(), city: 'Pune' })).toBe(false);
  });
});
