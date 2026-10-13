import { describe, expect, it } from 'vitest';
import {
  applyGstin,
  emptyProfileForm,
  formToProfile,
  issuesByField,
  profileToForm,
  selectableStates,
  validateProfileForm,
  type ProfileFormState,
} from './profileFormState';

const filled = (overrides: Partial<ProfileFormState> = {}): ProfileFormState => ({
  ...emptyProfileForm('regular'),
  name: '  Asha Rao Consulting ',
  gstin: '27aapfu0939f1zv',
  pan: 'aapfu0939f',
  line1: '12 Linking Road',
  city: 'Mumbai',
  postalCode: '400050',
  stateCode: '27',
  email: 'ASHA@Example.com ',
  ...overrides,
});

describe('emptyProfileForm', () => {
  it('starts blank with the chosen status and the unregistered note switched on', () => {
    const form = emptyProfileForm('unregistered');
    expect(form.gstStatus).toBe('unregistered');
    expect(form.unregisteredNote).toBe(true);
    expect(form.name).toBe('');
    expect(form.logoDataUrl).toBe('');
  });
});

describe('formToProfile', () => {
  it('normalises identifiers and builds a profile with the fixed id and country', () => {
    const profile = formToProfile(filled());
    expect(profile).toMatchObject({
      id: 'me',
      name: 'Asha Rao Consulting',
      gstStatus: 'regular',
      gstin: '27AAPFU0939F1ZV',
      pan: 'AAPFU0939F',
      email: 'asha@example.com',
      address: { line1: '12 Linking Road', city: 'Mumbai', postalCode: '400050', stateCode: '27', country: 'India' },
    });
    expect('line2' in profile.address).toBe(false);
    expect('bank' in profile).toBe(false);
    expect('lutNumber' in profile).toBe(false);
  });

  it('drops the GSTIN for an unregistered seller and keeps the note switch', () => {
    const profile = formToProfile(filled({ gstStatus: 'unregistered', unregisteredNote: false }));
    expect('gstin' in profile).toBe(false);
    expect(profile.unregisteredNote).toBe(false);
  });

  it('keeps the LUT number only for regular sellers', () => {
    expect(formToProfile(filled({ lutNumber: 'ad270326012345z' })).lutNumber).toBe('ad270326012345z');
    expect('lutNumber' in formToProfile(filled({ gstStatus: 'composition', lutNumber: 'x' }))).toBe(false);
  });

  it('builds bank details only when something was entered', () => {
    const profile = formToProfile(
      filled({ bankAccountName: 'Asha Rao', bankAccountNumber: '123456789012', ifsc: 'hdfc0001234', bankName: 'HDFC Bank', branch: ' Bandra ' }),
    );
    expect(profile.bank).toEqual({
      accountName: 'Asha Rao',
      accountNumber: '123456789012',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branch: 'Bandra',
    });
  });

  it('carries the logo, defaults and prefix through', () => {
    const profile = formToProfile(
      filled({ logoDataUrl: 'data:image/png;base64,AAAA', defaultNotes: 'Thanks', defaultTerms: 'Net 15', invoicePrefix: 'INV/', upiId: 'asha@okhdfc' }),
    );
    expect(profile).toMatchObject({
      logoDataUrl: 'data:image/png;base64,AAAA',
      defaultNotes: 'Thanks',
      defaultTerms: 'Net 15',
      invoicePrefix: 'INV/',
      upiId: 'asha@okhdfc',
    });
  });
});

describe('profileToForm', () => {
  it('round-trips a profile', () => {
    const profile = formToProfile(
      filled({ bankAccountName: 'Asha Rao', bankAccountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank', lutNumber: 'LUT1', upiId: 'asha@okhdfc' }),
    );
    expect(formToProfile(profileToForm(profile))).toEqual(profile);
  });

  it('turns missing optional values into empty strings', () => {
    const form = profileToForm(formToProfile(filled()));
    expect(form.line2).toBe('');
    expect(form.bankName).toBe('');
    expect(form.unregisteredNote).toBe(true);
  });
});

describe('validateProfileForm', () => {
  it('accepts a complete regular seller', () => {
    expect(validateProfileForm(filled())).toEqual([]);
  });

  it('accepts a minimal unregistered seller', () => {
    const form = emptyProfileForm('unregistered');
    form.name = 'Ravi';
    form.line1 = '4 Park Street';
    form.city = 'Kolkata';
    expect(validateProfileForm(form)).toEqual([]);
  });

  it('reports what is missing', () => {
    const paths = validateProfileForm(emptyProfileForm('regular')).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'address.line1', 'address.city', 'gstin']));
  });

  it('requires every bank field once one is filled', () => {
    const paths = validateProfileForm(filled({ bankName: 'HDFC Bank' })).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['bank.accountName', 'bank.accountNumber', 'bank.ifsc']));
    expect(paths).not.toContain('bank.bankName');
  });

  it('checks the format of the optional fields', () => {
    const paths = validateProfileForm(filled({ upiId: 'nope', pan: 'x', email: 'bad' })).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['upiId', 'pan', 'email']));
  });
});

describe('issuesByField', () => {
  it('keeps the first message for each field', () => {
    expect(
      issuesByField([
        { path: 'gstin', message: 'first' },
        { path: 'gstin', message: 'second' },
        { path: 'name', message: 'Enter a name' },
      ]),
    ).toEqual({ gstin: 'first', name: 'Enter a name' });
  });
});

describe('applyGstin', () => {
  it('upper-cases and trims what was typed', () => {
    expect(applyGstin(emptyProfileForm('regular'), ' 27aap ').gstin).toBe('27AAP');
  });

  it('fills the state from a valid GSTIN, and leaves it alone otherwise', () => {
    const valid = applyGstin(emptyProfileForm('regular'), '29AAGCB7383J1Z4');
    expect(valid.stateCode).toBe('29');
    const typing = applyGstin({ ...emptyProfileForm('regular'), stateCode: '07' }, '29AAGCB');
    expect(typing.stateCode).toBe('07');
  });
});

describe('selectableStates', () => {
  it('lists states by name without legacy or non-geographic codes', () => {
    const states = selectableStates();
    const labels = states.map((state) => state.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    expect(states.find((state) => state.value === '27')?.label).toBe('Maharashtra');
    for (const code of ['25', '28', '99']) expect(states.some((state) => state.value === code)).toBe(false);
  });
});
