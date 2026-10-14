/** A unique id for a new record. Uses the browser's UUID generator when there is one. */
export function newId(): string {
  const generator = globalThis.crypto;
  if (generator && typeof generator.randomUUID === 'function') return generator.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
