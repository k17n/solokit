import { INDIAN_STATES, validateGstin, type SellerGstStatus } from '@solokit/tax-engines';
import { normaliseSeller, validateSeller, type Issue, type SellerProfile } from '@solokit/tool-invoice';

export interface ProfileFormState {
  name: string;
  gstStatus: SellerGstStatus;
  gstin: string;
  pan: string;
  udyam: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  stateCode: string;
  email: string;
  phone: string;
  website: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string;
  upiId: string;
  lutNumber: string;
  invoicePrefix: string;
  defaultNotes: string;
  defaultTerms: string;
  unregisteredNote: boolean;
  logoDataUrl: string;
}

export function emptyProfileForm(gstStatus: SellerGstStatus): ProfileFormState {
  return {
    name: '',
    gstStatus,
    gstin: '',
    pan: '',
    udyam: '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    stateCode: '',
    email: '',
    phone: '',
    website: '',
    bankAccountName: '',
    bankAccountNumber: '',
    ifsc: '',
    bankName: '',
    branch: '',
    upiId: '',
    lutNumber: '',
    invoicePrefix: '',
    defaultNotes: '',
    defaultTerms: '',
    unregisteredNote: true,
    logoDataUrl: '',
  };
}

export function profileToForm(profile: SellerProfile): ProfileFormState {
  return {
    name: profile.name,
    gstStatus: profile.gstStatus,
    gstin: profile.gstin ?? '',
    pan: profile.pan ?? '',
    udyam: profile.udyam ?? '',
    line1: profile.address.line1,
    line2: profile.address.line2 ?? '',
    city: profile.address.city,
    postalCode: profile.address.postalCode ?? '',
    stateCode: profile.address.stateCode ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    website: profile.website ?? '',
    bankAccountName: profile.bank?.accountName ?? '',
    bankAccountNumber: profile.bank?.accountNumber ?? '',
    ifsc: profile.bank?.ifsc ?? '',
    bankName: profile.bank?.bankName ?? '',
    branch: profile.bank?.branch ?? '',
    upiId: profile.upiId ?? '',
    lutNumber: profile.lutNumber ?? '',
    invoicePrefix: profile.invoicePrefix ?? '',
    defaultNotes: profile.defaultNotes ?? '',
    defaultTerms: profile.defaultTerms ?? '',
    unregisteredNote: profile.unregisteredNote !== false,
    logoDataUrl: profile.logoDataUrl ?? '',
  };
}

const BANK_FIELDS = ['bankAccountName', 'bankAccountNumber', 'ifsc', 'bankName', 'branch'] as const;

function hasBankDetails(form: ProfileFormState): boolean {
  return BANK_FIELDS.some((field) => form[field].trim() !== '');
}

/** Turns what was typed into a normalised SellerProfile. Run `validateProfileForm` first. */
export function formToProfile(form: ProfileFormState): SellerProfile {
  const taxRegistered = form.gstStatus !== 'unregistered';
  const profile: SellerProfile = {
    id: 'me',
    name: form.name,
    gstStatus: form.gstStatus,
    address: {
      line1: form.line1,
      line2: form.line2,
      city: form.city,
      postalCode: form.postalCode,
      stateCode: form.stateCode,
      country: 'India',
    },
    pan: form.pan,
    udyam: form.udyam,
    email: form.email,
    phone: form.phone,
    website: form.website,
    upiId: form.upiId,
    invoicePrefix: form.invoicePrefix,
    defaultNotes: form.defaultNotes,
    defaultTerms: form.defaultTerms,
    logoDataUrl: form.logoDataUrl,
  };
  if (taxRegistered) profile.gstin = form.gstin;
  if (form.gstStatus === 'regular') profile.lutNumber = form.lutNumber;
  if (form.gstStatus === 'unregistered') profile.unregisteredNote = form.unregisteredNote;
  if (hasBankDetails(form)) {
    profile.bank = {
      accountName: form.bankAccountName,
      accountNumber: form.bankAccountNumber,
      ifsc: form.ifsc,
      bankName: form.bankName,
      branch: form.branch,
    };
  }
  return normaliseSeller(profile);
}

export function validateProfileForm(form: ProfileFormState): Issue[] {
  const issues = validateSeller(formToProfile(form));
  const seen = new Set(issues.map((issue) => issue.path));
  if (hasBankDetails(form)) {
    const required: [string, string, string][] = [
      ['bank.accountName', form.bankAccountName, 'Enter the account holder name'],
      ['bank.accountNumber', form.bankAccountNumber, 'Enter the account number'],
      ['bank.ifsc', form.ifsc, 'Enter the IFSC code'],
      ['bank.bankName', form.bankName, 'Enter the bank name'],
    ];
    for (const [path, value, message] of required) {
      if (value.trim() === '' && !seen.has(path)) issues.push({ path, message });
    }
  }
  return issues;
}

export function issuesByField(issues: Issue[]): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const issue of issues) {
    if (!(issue.path in byField)) byField[issue.path] = issue.message;
  }
  return byField;
}

/** Stores the typed GSTIN upper-cased, and fills the state from it once it is a valid GSTIN. */
export function applyGstin(form: ProfileFormState, gstin: string): ProfileFormState {
  const cleaned = gstin.trim().toUpperCase();
  const result = validateGstin(cleaned);
  return { ...form, gstin: cleaned, stateCode: result.valid ? result.stateCode : form.stateCode };
}

const HIDDEN_STATE_CODES = new Set(['25', '28', '99']);

export function selectableStates(): { value: string; label: string }[] {
  return INDIAN_STATES.filter((state) => !HIDDEN_STATE_CODES.has(state.code))
    .map((state) => ({ value: state.code, label: state.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
