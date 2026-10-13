import type { Address, BankDetails, Client, SellerProfile } from './model';

type Transform = (value: string) => string;
const upper: Transform = (value) => value.toUpperCase();
const lower: Transform = (value) => value.toLowerCase();

/**
 * Copies an object, trimming every string field (and applying a per-key case transform).
 * Strings that end up empty are dropped, so optional fields vanish instead of becoming "".
 */
function clean<T extends object>(source: T, transforms: Record<string, Transform> = {}, keep: readonly string[] = []): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (typeof value === 'string') {
      const text = (transforms[key] ?? ((v: string) => v))(value.trim());
      if (text === '' && !keep.includes(key)) continue;
      result[key] = text;
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

const addressOf = (address: Address): Address => clean(address, {}, ['line1', 'city', 'country']);
const bankOf = (bank: BankDetails): BankDetails => clean(bank, { ifsc: upper }, ['accountName', 'accountNumber', 'ifsc', 'bankName']);

export function normaliseSeller(seller: SellerProfile): SellerProfile {
  const { address, bank, ...rest } = seller;
  const result = clean(rest as SellerProfile, { gstin: upper, pan: upper, udyam: upper, email: lower }, ['name']);
  result.address = addressOf(address);
  if (bank) result.bank = bankOf(bank);
  return result;
}

export function normaliseClient(client: Client): Client {
  const { address, ...rest } = client;
  const result = clean(rest as Client, { gstin: upper, pan: upper, email: lower }, ['name']);
  result.address = addressOf(address);
  return result;
}
