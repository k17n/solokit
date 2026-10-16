import { validateGstin } from '@solokit/tax-engines';
import { normaliseClient, validateClient, type Client } from '@solokit/tool-invoice';
import { type Issue } from '@solokit/profile';

export interface ClientFormState {
  name: string;
  gstin: string;
  pan: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  stateCode: string;
  country: string;
  email: string;
  phone: string;
}

export function emptyClientForm(): ClientFormState {
  return {
    name: '',
    gstin: '',
    pan: '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    stateCode: '',
    country: 'India',
    email: '',
    phone: '',
  };
}

export function clientToForm(client: Client): ClientFormState {
  return {
    name: client.name,
    gstin: client.gstin ?? '',
    pan: client.pan ?? '',
    line1: client.address.line1,
    line2: client.address.line2 ?? '',
    city: client.address.city,
    postalCode: client.address.postalCode ?? '',
    stateCode: client.address.stateCode ?? '',
    country: client.address.country,
    email: client.email ?? '',
    phone: client.phone ?? '',
  };
}

export function formToClient(form: ClientFormState, id: string): Client {
  return normaliseClient({
    id,
    name: form.name,
    gstin: form.gstin,
    pan: form.pan,
    address: {
      line1: form.line1,
      line2: form.line2,
      city: form.city,
      postalCode: form.postalCode,
      stateCode: form.stateCode,
      country: form.country,
    },
    email: form.email,
    phone: form.phone,
  });
}

export function validateClientForm(form: ClientFormState): Issue[] {
  const client = formToClient(form, 'check');
  const issues = validateClient(client);
  if (client.address.line1.trim() === '') issues.push({ path: 'address.line1', message: "Enter the client's address" });
  if (client.address.city.trim() === '') issues.push({ path: 'address.city', message: "Enter the client's city" });
  return issues;
}

/** Stores the typed GSTIN upper-cased; a valid GSTIN also fills in the state and sets the country to India. */
export function applyClientGstin(form: ClientFormState, gstin: string): ClientFormState {
  const cleaned = gstin.trim().toUpperCase();
  const result = validateGstin(cleaned);
  return result.valid ? { ...form, gstin: cleaned, stateCode: result.stateCode, country: 'India' } : { ...form, gstin: cleaned };
}

export function isBlankClient(form: ClientFormState): boolean {
  return form.name.trim() === '' && form.line1.trim() === '' && form.city.trim() === '';
}
