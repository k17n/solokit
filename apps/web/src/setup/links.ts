import { getTools, toolHref } from '@solokit/registry';

/** The steps of the business setup, in order. */
export const SETUP_STEPS = ['tax', 'details', 'brand', 'payments', 'defaults'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export const SETUP_PATH = '/setup/';

/** The app home: the tools a set-up Business can use. "Get started" goes here, and it sends a new Business to setup first. */
export const APP_HOME = '/app/';

/** Where setup goes when it was not opened from somewhere: the app home, welcoming the person. */
export const AFTER_FIRST_SETUP = `${APP_HOME}?welcome=1`;

const isStep = (value: string | null): value is SetupStep => value !== null && (SETUP_STEPS as readonly string[]).includes(value);

/**
 * A path on this site to go back to, or null. Only plain same-site paths count ("/tools/invoice/"), never "//other.site"
 * or a full URL, so a link cannot send people somewhere else after setup.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

/** The setup page, coming back to `returnTo` when done, optionally opened at one step. */
export function setupHref(returnTo?: string, step?: SetupStep): string {
  const params = new URLSearchParams();
  const next = safeReturnPath(returnTo);
  if (next) params.set('next', next);
  if (step) params.set('step', step);
  const query = params.toString();
  return query ? `${SETUP_PATH}?${query}` : SETUP_PATH;
}

/** Reads the setup page's query string. */
export function readSetupQuery(search: string): { next: string | null; step: SetupStep | null } {
  const params = new URLSearchParams(search);
  const step = params.get('step');
  return { next: safeReturnPath(params.get('next')), step: isStep(step) ? step : null };
}

/** The tool a path opens, if it opens one. */
function toolAt(path: string) {
  return getTools().find((candidate) => path.startsWith(toolHref(candidate.slug)));
}

/** Whether the path opens a tool, such as "/tools/invoice/". */
export const isToolPath = (path: string): boolean => toolAt(path) !== undefined;

/** What to call the page someone returns to, for a button: "Invoice generator", "Your business", "your tools". */
export function returnLabel(path: string): string {
  if (path === '/business/' || path.startsWith('/business/#')) return 'Your business';
  if (path === APP_HOME || path.startsWith(`${APP_HOME}?`)) return 'your tools';
  return toolAt(path)?.name ?? 'where you were';
}
