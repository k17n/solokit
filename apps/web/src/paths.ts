import { getTools } from '@solokit/registry';

/**
 * Where things live. Everything that reads or writes a Business is under /app/, inside one app shell; the pages outside
 * it (home, privacy, the tool landing pages) are the static site.
 */
export const APP_HOME = '/app/';
export const SETUP_PATH = '/app/setup/';
export const BUSINESS_PATH = '/app/business/';

/** The tool inside the app, such as "/app/invoice/". */
export const toolAppHref = (slug: string): string => `${APP_HOME}${slug}/`;

/** The ready tool that a path inside the app opens, if any. */
export function appToolAt(path: string) {
  return getTools().find((tool) => tool.status === 'available' && path.startsWith(toolAppHref(tool.slug)));
}
