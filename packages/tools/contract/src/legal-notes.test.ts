import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIBRARY } from './library';

const notes = readFileSync(new URL('../../../../docs/legal-content-notes.md', import.meta.url), 'utf-8');

describe('docs/legal-content-notes.md', () => {
  it('names the current wording version', () => {
    expect(notes).toContain(LIBRARY.version);
  });
  it('lists every clause, choice, setting and assumption in the library', () => {
    for (const clause of LIBRARY.clauses) expect(notes, `clause ${clause.id}`).toContain(`### \`${clause.id}\``);
    for (const option of LIBRARY.options) expect(notes, `option ${option.id}`).toContain(`| \`${option.id}\` |`);
    for (const variable of LIBRARY.variables) expect(notes, `setting ${variable.id}`).toContain(`| \`${variable.id}\` |`);
    for (const assumption of LIBRARY.assumptions) expect(notes, assumption.id).toContain(assumption.text);
    for (const note of LIBRARY.notes) expect(notes, note.id).toContain(note.body);
    for (const clause of LIBRARY.clauses) expect(notes, `explanation of ${clause.id}`).toContain(clause.explanation);
  });
});
