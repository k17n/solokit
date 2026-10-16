import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { ThemesScreen } from './ThemesScreen';
import type { PdfRenderer } from './usePdfPreview';

const pdf = new Blob(['pdf'], { type: 'application/pdf' });

async function setup(renderPdf?: PdfRenderer) {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore());
  const renderer = renderPdf ?? vi.fn(async () => pdf);
  render(<ThemesScreen storage={storage} profile={makeSeller()} renderPdf={renderer} now={() => new Date(2026, 9, 16, 10, 0)} />);
  await screen.findByRole('list', { name: 'Themes' });
  return { storage, renderer };
}

const pick = (name: string) => userEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}\\b`) }));

describe('ThemesScreen', () => {
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:theme'), revokeObjectURL: vi.fn() });
  });

  it('lists the six read-only presets', async () => {
    await setup();
    const list = screen.getByRole('list', { name: 'Themes' });
    for (const name of ['Classic', 'Modern', 'Minimal', 'Bold', 'Consultant', 'Formal']) {
      expect(within(list).getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    await pick('Modern');
    expect(screen.queryByRole('button', { name: 'Delete theme' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as my theme' })).toBeInTheDocument();
  });

  it('marks the chosen theme as current', async () => {
    await setup();
    await pick('Bold');
    expect(screen.getByRole('button', { name: /^Bold/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /^Classic/ })).not.toHaveAttribute('aria-current');
  });

  it('saves an edited preset as my theme, keeping the layout, and renders the preview with it', async () => {
    const { storage, renderer } = await setup();
    await pick('Modern');
    const accent = screen.getByLabelText('Accent colour', { exact: true });
    await userEvent.clear(accent);
    await userEvent.type(accent, '#7C2D12');
    await userEvent.selectOptions(screen.getByLabelText('Font'), 'poppins');
    await userEvent.clear(screen.getByLabelText('Theme name'));
    await userEvent.type(screen.getByLabelText('Theme name'), 'Rust');
    await userEvent.click(screen.getByRole('button', { name: 'Save as my theme' }));

    await waitFor(async () => expect(await storage.themes.list()).toHaveLength(1));
    const [saved] = await storage.themes.list();
    expect(saved).toMatchObject({ name: 'Rust', layout: 'modern', accent: '#7C2D12', fontId: 'poppins' });
    expect(saved!.id).not.toBe('modern');
    expect(await screen.findByRole('button', { name: /^Rust/ })).toHaveAttribute('aria-current', 'true');
    await waitFor(() =>
      expect(renderer).toHaveBeenCalledWith(expect.objectContaining({ theme: expect.objectContaining({ accent: '#7C2D12', fontId: 'poppins' }) })),
    );
  });

  it('shows the live preview', async () => {
    await setup();
    expect(await screen.findByTitle('Invoice preview')).toBeInTheDocument();
  });

  it('rejects a colour that is not a hex value', async () => {
    const { storage } = await setup();
    await pick('Classic');
    const text = screen.getByLabelText('Text colour', { exact: true });
    await userEvent.clear(text);
    await userEvent.type(text, 'blue');
    expect(await screen.findByText('Use a colour like #0B1B3A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save as my theme' }));
    expect(await storage.themes.list()).toHaveLength(0);
  });

  it('warns about low contrast but still allows saving', async () => {
    const { storage } = await setup();
    await pick('Classic');
    const text = screen.getByLabelText('Text colour', { exact: true });
    await userEvent.clear(text);
    await userEvent.type(text, '#EEEEEE');
    expect(await screen.findByText(/hard to read/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save as my theme' }));
    await waitFor(async () => expect(await storage.themes.list()).toHaveLength(1));
  });

  it('refuses a name another theme already has', async () => {
    const { storage } = await setup();
    await pick('Classic');
    await userEvent.clear(screen.getByLabelText('Theme name'));
    await userEvent.type(screen.getByLabelText('Theme name'), 'modern');
    await userEvent.click(screen.getByRole('button', { name: 'Save as my theme' }));
    expect(await screen.findByText('Another theme already has that name.')).toBeInTheDocument();
    expect(await storage.themes.list()).toHaveLength(0);
  });

  async function makeMine() {
    const ctx = await setup();
    await pick('Consultant');
    await userEvent.clear(screen.getByLabelText('Theme name'));
    await userEvent.type(screen.getByLabelText('Theme name'), 'Mine');
    await userEvent.click(screen.getByRole('button', { name: 'Save as my theme' }));
    await screen.findByRole('button', { name: 'Delete theme' });
    return ctx;
  }

  it('renames and updates my theme', async () => {
    const { storage } = await makeMine();
    await userEvent.clear(screen.getByLabelText('Theme name'));
    await userEvent.type(screen.getByLabelText('Theme name'), 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => expect((await storage.themes.list()).map((theme) => theme.name)).toEqual(['Renamed']));
  });

  it('duplicates my theme under a free name', async () => {
    const { storage } = await makeMine();
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await waitFor(async () => expect((await storage.themes.list()).map((theme) => theme.name).sort()).toEqual(['Mine', 'Mine copy']));
  });

  it('deletes my theme only after a second confirmation, and can be kept', async () => {
    const { storage } = await makeMine();
    await userEvent.click(screen.getByRole('button', { name: 'Delete theme' }));
    expect(await storage.themes.list()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(await storage.themes.list()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Delete theme' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete theme' }));
    await waitFor(async () => expect(await storage.themes.list()).toHaveLength(0));
    expect(screen.queryByRole('button', { name: /^Mine/ })).not.toBeInTheDocument();
  });

  it('sets the default theme, and deleting the default puts Classic back', async () => {
    const { storage } = await makeMine();
    await userEvent.click(screen.getByRole('button', { name: 'Set as default' }));
    await waitFor(async () => expect((await storage.settings.get()).defaultThemeId).not.toBe('classic'));
    expect(await screen.findByRole('button', { name: /^Mine/ })).toHaveTextContent('Default');
    await userEvent.click(screen.getByRole('button', { name: 'Delete theme' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete theme' }));
    await waitFor(async () => expect((await storage.settings.get()).defaultThemeId).toBe('classic'));
  });

  it('can set a preset as the default', async () => {
    const { storage } = await setup();
    await pick('Bold');
    await userEvent.click(screen.getByRole('button', { name: 'Set as default' }));
    await waitFor(async () => expect((await storage.settings.get()).defaultThemeId).toBe('bold'));
  });
});
