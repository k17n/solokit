import { INDIAN_STATES, validateGstin, type SellerGstStatus } from '@solokit/tax-engines';
import { normaliseHex, normaliseProfile, validateProfile, type BrandSource, type BrandThemeLink, type Issue, type BusinessProfile } from '@solokit/profile';

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
  brandPrimary: string;
  brandSecondary: string;
  brandText: string;
  brandBackground: string;
  /** Where the brand colours came from. Empty while there are none. */
  brandSource: BrandSource | '';
  /** Carried through unchanged so saving the form never loses the link to the brand theme. */
  brandTheme?: BrandThemeLink;
  /** True while the GST status is only a placeholder (the person has not chosen one yet). */
  gstUnconfirmed?: boolean;
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
    brandPrimary: '',
    brandSecondary: '',
    brandText: '',
    brandBackground: '',
    brandSource: '',
  };
}

export function profileToForm(profile: BusinessProfile): ProfileFormState {
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
    brandPrimary: profile.brand?.primary ?? '',
    brandSecondary: profile.brand?.secondary ?? '',
    brandText: profile.brand?.text ?? '',
    brandBackground: profile.brand?.background ?? '',
    brandSource: profile.brand ? (profile.brandSource ?? 'manual') : '',
    ...(profile.brandTheme ? { brandTheme: profile.brandTheme } : {}),
    ...(profile.gstUnconfirmed ? { gstUnconfirmed: true } : {}),
  };
}

const BANK_FIELDS = ['bankAccountName', 'bankAccountNumber', 'ifsc', 'bankName', 'branch'] as const;

function hasBankDetails(form: ProfileFormState): boolean {
  return BANK_FIELDS.some((field) => form[field].trim() !== '');
}

/** Turns what was typed into a normalised BusinessProfile. Run `validateProfileForm` first. */
export function formToProfile(form: ProfileFormState): BusinessProfile {
  const taxRegistered = form.gstStatus !== 'unregistered';
  const profile: BusinessProfile = {
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
  const colour = (value: string) => normaliseHex(value) ?? value;
  const brand = {
    ...(form.brandPrimary.trim() ? { primary: colour(form.brandPrimary) } : {}),
    ...(form.brandSecondary.trim() ? { secondary: colour(form.brandSecondary) } : {}),
    ...(form.brandText.trim() ? { text: colour(form.brandText) } : {}),
    ...(form.brandBackground.trim() ? { background: colour(form.brandBackground) } : {}),
  };
  if (Object.keys(brand).length > 0) {
    profile.brand = brand;
    profile.brandSource = form.brandSource || 'manual';
  }
  if (form.brandTheme) profile.brandTheme = form.brandTheme;
  if (form.gstUnconfirmed) profile.gstUnconfirmed = true;
  return normaliseProfile(profile);
}

export function validateProfileForm(form: ProfileFormState): Issue[] {
  const issues = validateProfile(formToProfile(form));
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
