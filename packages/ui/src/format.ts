const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-13" -> "13 Oct 2026". Pure string handling, so time zones cannot shift the day. */
export function formatIsoDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    throw new RangeError(`Expected an ISO date (YYYY-MM-DD), got "${iso}"`);
  }
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`;
}
