import { isHexColour } from './colour';
import { PROFILE_ID, PROFILE_SCHEMA_VERSION, type BrandColours, type BusinessProfile } from './model';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const BRAND_KEYS = ['primary', 'secondary', 'text', 'background'] as const;

/**
 * Brings a stored profile up to the current shape. Safe to run on any record, any number of times.
 *
 * - 1 (no `schemaVersion`) to 2: brand colours and their source did not exist. Anything under `brand` that is not a
 *   #RRGGBB colour is dropped, `brandSource` is kept only when it is valid and there are colours, and an `address`
 *   that is missing becomes empty so the form can open the record.
 * - A record written by a newer SoloKit (higher version) is returned as it is, never downgraded.
 *
 * Returns undefined for something that is not a profile record at all.
 */
export function migrateProfile(raw: unknown): BusinessProfile | undefined {
  if (!isRecord(raw) || typeof raw['name'] !== 'string') return undefined;
  const version = typeof raw['schemaVersion'] === 'number' ? raw['schemaVersion'] : 1;
  if (version > PROFILE_SCHEMA_VERSION) return raw as unknown as BusinessProfile;

  const { brand: rawBrand, brandSource: rawSource, ...rest } = raw;
  const profile = { ...rest, id: PROFILE_ID, schemaVersion: PROFILE_SCHEMA_VERSION } as unknown as BusinessProfile;
  if (!isRecord(raw['address'])) profile.address = { line1: '', city: '', country: 'India' };

  if (isRecord(rawBrand)) {
    const brand: BrandColours = {};
    for (const key of BRAND_KEYS) {
      const value = rawBrand[key];
      if (isHexColour(value)) brand[key] = value.toUpperCase();
    }
    if (Object.keys(brand).length > 0) {
      profile.brand = brand;
      if (rawSource === 'logo' || rawSource === 'manual') profile.brandSource = rawSource;
    }
  }
  return profile;
}
