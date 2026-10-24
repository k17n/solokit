/** Leaves the page for another one on this site. Its own module, so tests can replace it (jsdom cannot navigate). */
export function navigate(url: string, { replace = false }: { replace?: boolean } = {}): void {
  if (replace) window.location.replace(url);
  else window.location.assign(url);
}
