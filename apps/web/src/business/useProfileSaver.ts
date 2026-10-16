import { useCallback } from 'react';
import { DEFAULT_WORKSPACE_NAME } from '@solokit/storage';
import type { BusinessProfile } from '@solokit/profile';
import type { InvoiceStorage } from '@solokit/tool-invoice';
import { useOptionalWorkspaces } from '../workspace/WorkspaceProvider';

/**
 * Saves the Business's profile. The link to the brand theme is not something a form edits, so it is always taken from
 * what is saved: a form opened before the theme was made cannot erase it. Also records that setup is finished.
 */
export async function saveBusinessProfile(storage: InvoiceStorage, next: BusinessProfile): Promise<BusinessProfile> {
  const stored = await storage.profile.get();
  const { brandTheme: _stale, ...rest } = next;
  const merged: BusinessProfile = stored?.brandTheme ? { ...rest, brandTheme: stored.brandTheme } : rest;
  await storage.profile.save(merged);
  try {
    await storage.settings.update({ onboarded: true });
  } catch (error) {
    // The profile is saved; losing the flag must not keep the person on the setup step.
    console.error('Could not record that setup is finished', error);
  }
  return merged;
}

/**
 * {@link saveBusinessProfile} for a screen: it also keeps the Business's name in step with the profile's name while the
 * two have been the same (or the Business still has the placeholder name), so the switcher shows the name people typed.
 * A name someone set on purpose in "Your businesses" is left alone.
 */
export function useProfileSaver(storage: InvoiceStorage | null): (next: BusinessProfile, previous?: BusinessProfile | null) => Promise<BusinessProfile> {
  const workspaces = useOptionalWorkspaces();
  const current = workspaces?.current ?? null;
  const rename = workspaces?.rename;
  return useCallback(
    async (next, previous) => {
      if (!storage) throw new Error('Storage is not ready');
      const saved = await saveBusinessProfile(storage, next);
      const inStep = previous ? previous.name === current?.name : current?.name === DEFAULT_WORKSPACE_NAME;
      if (current && rename && inStep && saved.name.trim() !== '' && saved.name.trim() !== current.name) {
        try {
          await rename(current.id, saved.name);
        } catch (error) {
          console.warn('Could not rename the business to match its profile', error);
        }
      }
      return saved;
    },
    [storage, current, rename],
  );
}
