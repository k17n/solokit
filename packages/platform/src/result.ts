/** The answer from any extension. Nothing here throws for "not available"; callers branch on `ok`. */
export type ExtensionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; reason: 'unavailable' | 'not-entitled' | 'failed'; message?: string };

export const UNAVAILABLE: ExtensionResult<never> = { ok: false, reason: 'unavailable' };
