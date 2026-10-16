/**
 * Remembers, per Business and tool, that the person chose "Skip for now" on the setup step, so it is not asked on every
 * visit. It is only a convenience, kept in localStorage; if that is unavailable the step simply shows again.
 */
const key = (tool: string, workspaceId: string) => `solokit-setup-skipped:${tool}:${workspaceId}`;

export function wasSetupSkipped(tool: string, workspaceId: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key(tool, workspaceId)) === '1';
  } catch {
    return false;
  }
}

export function rememberSetupSkipped(tool: string, workspaceId: string): void {
  try {
    globalThis.localStorage?.setItem(key(tool, workspaceId), '1');
  } catch {
    // Not remembered; the step shows again next time.
  }
}
