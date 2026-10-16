import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// Keystrokes and clicks need no pause between them in a test, and a pause per keystroke adds up on a loaded machine.
const direct = userEvent as unknown as Record<string, (...args: unknown[]) => unknown>;
for (const name of ['click', 'dblClick', 'tripleClick', 'hover', 'unhover', 'type', 'clear', 'keyboard', 'tab', 'paste', 'upload', 'selectOptions', 'deselectOptions', 'pointer']) {
  const original = direct[name];
  if (original) direct[name] = (...args) => (userEvent.setup({ delay: null }) as unknown as Record<string, (...a: unknown[]) => unknown>)[name]!(...args);
}
configure({ asyncUtilTimeout: 10_000 });
