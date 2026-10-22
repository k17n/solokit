import { toolAppHref } from '../paths';

/**
 * Links that open a tool at a given screen: `?new=<kind>` starts a new document of that kind, `?doc=<id>` opens a saved
 * one. The tool reads them once when it opens and then takes them out of the address, so a reload does not start
 * another new document.
 */
export interface DeepLink {
  /** The kind of document to start, as the tool names it ("quote", "nda-mutual"). */
  new?: string;
  /** A saved document to open. */
  doc?: string;
}

export function deepLinkHref(slug: string, link: DeepLink): string {
  const params = new URLSearchParams();
  if (link.new) params.set('new', link.new);
  if (link.doc) params.set('doc', link.doc);
  const query = params.toString();
  return query ? `${toolAppHref(slug)}?${query}` : toolAppHref(slug);
}

/** Reads the deep link from the address, and takes it out so it is used only once. */
export function takeDeepLink(): DeepLink {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const link: DeepLink = {};
  const kind = params.get('new');
  const doc = params.get('doc');
  if (kind) link.new = kind;
  if (doc) link.doc = doc;
  if (kind || doc) {
    params.delete('new');
    params.delete('doc');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }
  return link;
}
