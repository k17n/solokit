'use client';

import { useCallback } from 'react';
import { useConfirmLeave } from './unsavedGuard';
import { useOptionalWorkspaces } from './WorkspaceProvider';

/** switchTo, but it first asks about unsaved work. Resolves false when the person stayed. */
export function useGuardedSwitch(): (id: string) => Promise<boolean> {
  const switchTo = useOptionalWorkspaces()?.switchTo;
  const confirmLeave = useConfirmLeave();
  return useCallback(
    async (id) => {
      if (!switchTo) throw new Error('The businesses are not available here');
      if (!(await confirmLeave())) return false;
      await switchTo(id);
      return true;
    },
    [confirmLeave, switchTo],
  );
}
