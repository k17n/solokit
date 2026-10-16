import type { DataStore } from '@solokit/storage';
import { migrateProfile } from './migrate';
import { PROFILE_ID, PROFILE_SCHEMA_VERSION, type BusinessProfile } from './model';

export interface ProfileRepository {
  /** The saved profile, upgraded to the current shape, or undefined when nothing is saved yet. */
  get(): Promise<BusinessProfile | undefined>;
  /** Saves the profile as the one record of this Business. Stamps the schema version. */
  save(profile: BusinessProfile): Promise<void>;
}

export function createProfileRepository(store: DataStore): ProfileRepository {
  return {
    async get() {
      return migrateProfile(await store.get('profile', PROFILE_ID));
    },
    save: (profile) =>
      store.put('profile', { ...profile, id: PROFILE_ID, schemaVersion: Math.max(profile.schemaVersion ?? 0, PROFILE_SCHEMA_VERSION) }),
  };
}
