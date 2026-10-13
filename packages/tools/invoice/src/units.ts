export const BILLING_UNITS = ['hours', 'days', 'months', 'items', 'fixed', 'retainer'] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

export const BILLING_UNIT_LABELS: Record<BillingUnit, string> = {
  hours: 'Hours',
  days: 'Days',
  months: 'Months',
  items: 'Items',
  fixed: 'Fixed fee',
  retainer: 'Retainer',
};

/** Up to three decimals, trailing zeros trimmed: 7.5, 24, 1.235. */
function trimmed(quantity: number): string {
  return Number(quantity.toFixed(3)).toString();
}

function counted(quantity: number, singular: string, plural: string): string {
  return `${trimmed(quantity)} ${quantity === 1 ? singular : plural}`;
}

/** How a quantity reads on an invoice line: "24 hrs", "3 days", "Fixed fee". */
export function formatQuantity(quantity: number, unit: BillingUnit): string {
  switch (unit) {
    case 'hours':
      return counted(quantity, 'hr', 'hrs');
    case 'days':
      return counted(quantity, 'day', 'days');
    case 'months':
      return counted(quantity, 'month', 'months');
    case 'items':
      return trimmed(quantity);
    case 'fixed':
      return quantity === 1 ? 'Fixed fee' : `${trimmed(quantity)} × fixed fee`;
    case 'retainer':
      return quantity === 1 ? 'Retainer' : `${trimmed(quantity)} × retainer`;
  }
}
