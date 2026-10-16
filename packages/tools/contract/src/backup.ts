import { StorageError } from '@solokit/storage';
import { CONTRACT_KINDS, PARTY_ROLES, type ContractKind } from './model';

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

const isTextList = (value: unknown): boolean => Array.isArray(value) && value.every(isText);
const isList = (value: unknown, each: (entry: unknown) => boolean): boolean => Array.isArray(value) && value.every(each);

function isDocParagraph(value: unknown): boolean {
  return isRecord(value) && isText(value['number']) && isText(value['text']) && isList(value['items'], (item) => isRecord(item) && isText(item['label']) && isText(item['text']));
}

function isDocClause(value: unknown): boolean {
  return isRecord(value) && isText(value['id']) && value['id'] !== '' && isText(value['number']) && isText(value['title']) && isList(value['paragraphs'], isDocParagraph);
}

/** The frozen wording of a final agreement: every part the PDF and Word builders read must be there and be text. */
function isFrozenDocument(value: unknown, id: unknown, kind: unknown, parties: readonly unknown[]): boolean {
  if (!isRecord(value)) return false;
  return (
    value['contractId'] === id &&
    value['kind'] === kind &&
    isText(value['heading']) &&
    isText(value['introduction']) &&
    isList(value['parties'], (party) => isRecord(party) && isText(party['label']) && isText(party['text'])) &&
    isText(value['closing']) &&
    isList(value['clauses'], isDocClause) &&
    isList(value['schedules'], (schedule) => isRecord(schedule) && isText(schedule['title']) && isList(schedule['sections'], (section) => isRecord(section) && isText(section['heading']) && isTextList(section['lines']))) &&
    isText(value['signatureIntro']) &&
    isList(value['signatures'], (signature) => isRecord(signature) && isText(signature['heading']) && isText(signature['signatoryName']) && isText(signature['signatoryTitle']) && (signature['place'] === undefined || isText(signature['place']))) &&
    (value['signatures'] as unknown[]).length === parties.length &&
    isText(value['notice']) &&
    isText(value['libraryVersion'])
  );
}

function isFrozenSummary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const text = (key: string) => isText(value[key]);
  return (
    text('contractTitle') &&
    text('heading') &&
    text('notice') &&
    text('libraryVersion') &&
    isList(value['parties'], (party) => isRecord(party) && isText(party['role']) && isText(party['name'])) &&
    isList(value['choices'], (choice) => isRecord(choice) && isText(choice['label']) && isText(choice['value'])) &&
    isList(value['keyDates'], (date) => isRecord(date) && isText(date['label']) && isText(date['value'])) &&
    isList(value['clauses'], (clause) => isRecord(clause) && isText(clause['number']) && isText(clause['title']) && isText(clause['explanation']) && isText(clause['rationale']) && isText(clause['risk'])) &&
    isList(value['questions'], (question) => isRecord(question) && isText(question['topic']) && isText(question['text'])) &&
    isRecord(value['stampDuty']) &&
    isText(value['stampDuty']['text'])
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
    // The two parties must hold the roles of the kind, in order: the document builders and the editor rely on it.
    const roles = PARTY_ROLES[record['kind'] as ContractKind];
    if (!(parties as unknown[]).every((party, index) => isRecord(party) && party['role'] === roles[index])) {
      throw new StorageError('The backup has an agreement whose parties do not match its type, so it was not restored');
    }
    const frozen = record['finalDocument'];
    if (frozen !== undefined && !isFrozenDocument(frozen, record['id'], record['kind'], parties as unknown[])) {
      throw new StorageError('The backup has an agreement with damaged final wording, so it was not restored');
    }
    const frozenSummary = record['finalSummary'];
    if (frozenSummary !== undefined && !isFrozenSummary(frozenSummary)) {
      throw new StorageError('The backup has an agreement with a damaged review summary, so it was not restored');
    }
    if (record['status'] === 'final' && frozen === undefined) {
      throw new StorageError('The backup has a final agreement without its wording, so it was not restored');
    }
  }
}
