/** ISO date the values below were last checked against public sources. Verify with a CA before relying on them. */
export const IN_RULES_AS_OF = '2026-10-13';

/** Slabs the UI offers. 12% and 28% were retired by the GST Council on 2025-09-22. */
export const CURRENT_GST_SLABS = [0, 5, 18, 40] as const;

/** Special rates (e.g. gold, rough diamonds) available as an advanced choice. */
export const SPECIAL_GST_RATES = [0.25, 3] as const;

/** Retired slabs. The engine still accepts them so older invoices can be recreated. */
export const LEGACY_GST_SLABS = [12, 28] as const;

export const GST_SLAB_REFORM_DATE = '2025-09-22';

const ALLOWED_RATES: readonly number[] = [...CURRENT_GST_SLABS, ...SPECIAL_GST_RATES, ...LEGACY_GST_SLABS];

export function isAllowedGstRate(rate: number): boolean {
  return ALLOWED_RATES.includes(rate);
}

/** True when a retired rate is used on an invoice dated on or after the reform (the UI should warn). */
export function isLegacyRateForDate(rate: number, isoDate: string): boolean {
  return (LEGACY_GST_SLABS as readonly number[]).includes(rate) && isoDate >= GST_SLAB_REFORM_DATE;
}

const LAKH = 100_000 * 100; // paise

/** Aggregate-turnover limits above which GST registration is mandatory, in paise. */
export const REGISTRATION_THRESHOLDS = {
  services: 20 * LAKH,
  goods: 40 * LAKH,
  servicesSpecialCategory: 10 * LAKH,
  goodsSpecialCategory: 20 * LAKH,
} as const;
