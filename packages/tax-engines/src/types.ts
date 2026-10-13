export interface CountryInfo {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** ISO 4217 */
  currency: string;
  status: 'available' | 'coming-soon';
}

/** A country's tax rules behind one interface. Countries are plugins. */
export interface TaxEngine<TInput, TResult> {
  country: CountryInfo;
  /** ISO date the bundled rates and thresholds were last verified. */
  rulesAsOf: string;
  calculate(input: TInput): TResult;
}
