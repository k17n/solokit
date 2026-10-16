import { StorageError } from '@solokit/storage';
import { CONTRACT_KINDS } from './model';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';

const INCOMPLETE = 'The backup has an agreement that is incomplete, so it was not restored';

function isParty(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const address = value['address'];
  return (
    isText(value['name']) &&
    isText(value['role']) &&
    isText(value['email']) &&
    isText(value['signatoryName']) &&
    isText(value['signatoryTitle']) &&
    isRecord(address) &&
    isText(address['line1']) &&
    isText(address['city'])
  );
}

function isMilestone(value: unknown): boolean {
  return isRecord(value) && isText(value['id']) && isText(value['title']) && typeof value['amount'] === 'number' && isText(value['due']);
}

/**
 * Checks the contract records of a backup file. Backups made before agreements existed have none, which is fine.
 * Throws StorageError for the first record that is not a usable agreement, so nothing is restored.
 */
export function checkContractRecords(records: readonly unknown[]): void {
  for (const record of records) {
    if (!isRecord(record)) throw new StorageError(INCOMPLETE);
    const jurisdiction = record['jurisdiction'];
    const variables = record['variables'];
    const options = record['options'];
    const overrides = record['clauseOverrides'];
    const milestones = record['milestones'];
    const parties = record['parties'];
    const valid =
      isText(record['id']) &&
      (CONTRACT_KINDS as readonly string[]).includes(record['kind'] as string) &&
      isText(record['title']) &&
      (record['status'] === 'draft' || record['status'] === 'final') &&
      Array.isArray(parties) &&
      parties.length === 2 &&
      parties.every(isParty) &&
      isText(record['effectiveDate']) &&
      isRecord(variables) &&
      Object.values(variables).every((value) => isText(value) || typeof value === 'number') &&
      isRecord(options) &&
      Object.values(options).every(isText) &&
      isRecord(overrides) &&
      Object.values(overrides).every((value) => typeof value === 'boolean') &&
      Array.isArray(milestones) &&
      milestones.every(isMilestone) &&
      isRecord(jurisdiction) &&
      isText(jurisdiction['city']) &&
      isText(jurisdiction['state']) &&
      isText(record['createdAt']) &&
      isText(record['updatedAt']) &&
      typeof record['version'] === 'number' &&
      isText(record['libraryVersion']) &&
      (record['themeId'] === undefined || isText(record['themeId'])) &&
      (record['placeOfSigning'] === undefined || isText(record['placeOfSigning']));
    if (!valid) throw new StorageError(INCOMPLETE);
    const frozen = record['finalDocument'];
    if (frozen !== undefined && (!isRecord(frozen) || !Array.isArray(frozen['clauses']) || !Array.isArray(frozen['signatures']))) {
      throw new StorageError('The backup has an agreement with damaged final wording, so it was not restored');
    }
    if (record['status'] === 'final' && frozen === undefined) {
      throw new StorageError('The backup has a final agreement without its wording, so it was not restored');
    }
  }
}
