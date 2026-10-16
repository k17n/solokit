import { isHexColour } from './colour';
import type { Address, BankDetails, BrandColours, BusinessProfile } from './model';

type Transform = (value: string) => string;
const upper: Transform = (value) => value.toUpperCase();
const lower: Transform = (value) => value.toLowerCase();

/**
 * Copies an object, trimming every string field (and applying a per-key case transform).
 * Strings that end up empty are dropped, so optional fields vanish instead of becoming "".
 */
export function cleanFields<T extends object>(source: T, transforms: Record<string, Transform> = {}, keep: readonly string[] = []): T {
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

export const normaliseAddress = (address: Address): Address => cleanFields(address, {}, ['line1', 'city', 'country']);
const bankOf = (bank: BankDetails): BankDetails => cleanFields(bank, { ifsc: upper }, ['accountName', 'accountNumber', 'ifsc', 'bankName']);

const upperColour: Transform = (value) => (isHexColour(value) ? value.toUpperCase() : value);

/** Upper-cases valid colours; an empty brand disappears. Invalid colours are kept so validation can report them. */
function brandOf(brand: BrandColours): BrandColours | undefined {
  const cleaned = cleanFields(brand, { primary: upperColour, secondary: upperColour, text: upperColour, background: upperColour });
  return Object.keys(cleaned).length === 0 ? undefined : cleaned;
}

export function normaliseProfile(profile: BusinessProfile): BusinessProfile {
  const { address, bank, brand, ...rest } = profile;
  const result = cleanFields(rest as BusinessProfile, { gstin: upper, pan: upper, udyam: upper, email: lower, website: lower }, ['name']);
  result.address = normaliseAddress(address);
  if (bank) result.bank = bankOf(bank);
  const colours = brand ? brandOf(brand) : undefined;
  if (colours) result.brand = colours;
  else delete result.brandSource;
  return result;
}
