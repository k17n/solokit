import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import type { BusinessProfile } from '@solokit/profile';
import { BrandThemeCard } from './BrandThemeCard';

const brand = { primary: '#7C2D12', text: '#1A1A1A', background: '#FFFFFF' };

async function setup(profile: BusinessProfile = makeSeller({ name: 'Asha Rao', brand, brandSource: 'logo' })) {
  const storage = createInvoiceStorage(createMemoryStore());
  await storage.profile.save(profile);
  const onChanged = vi.fn();
  const onThemeChanged = vi.fn();
  const view = (current: BusinessProfile, draftBrand?: BusinessProfile['brand']) => (
    <BrandThemeCard storage={storage} profile={current} onChanged={onChanged} onThemeChanged={onThemeChanged} {...(draftBrand !== undefined ? { draftBrand } : {})} />
  );
  return { storage, onChanged, onThemeChanged, view, profile };
}

describe('BrandThemeCard', () => {
  it('renders nothing while there are no brand colours', async () => {
    const { view } = await setup(makeSeller());
    const { container } = render(view(makeSeller()));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('creates the brand theme in one click, uses it for new documents by default, and reports the change', async () => {
    const { storage, view, profile, onChanged, onThemeChanged } = await setup();
    render(view(profile));
    await userEvent.click(await screen.findByRole('button', { name: 'Create a Brand theme' }));
    expect(await screen.findByText('Created the theme "Asha Rao brand" and set it as the theme for new documents.')).toBeInTheDocument();
    const [theme] = await storage.themes.list();
    expect(theme).toMatchObject({ name: 'Asha Rao brand', accent: '#7C2D12' });
    expect((await storage.settings.get()).defaultThemeId).toBe(theme?.id);
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ brandTheme: expect.objectContaining({ themeId: theme?.id }) }));
    expect(onThemeChanged).toHaveBeenCalled();
    expect(await screen.findByText(/matches your brand colours/)).toBeInTheDocument();
  });

  it('can create the theme without making it the default', async () => {
    const { storage, view, profile } = await setup();
    render(view(profile));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Use it for new documents' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create a Brand theme' }));
    await screen.findByText('Created the theme "Asha Rao brand".');
    expect((await storage.settings.get()).defaultThemeId).toBe('classic');
  });

  it('asks to save first when the brand colours in the form are not saved yet', async () => {
    const { view, profile } = await setup();
    render(view(profile, { primary: '#0F766E' }));
    expect(await screen.findByText(/Save your business details to make a theme/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create a Brand theme' })).not.toBeInTheDocument();
  });

  it('offers to update an untouched brand theme when the colours changed, and updates it in place', async () => {
    const { storage, view, profile } = await setup();
    const first = render(view(profile));
    await userEvent.click(await screen.findByRole('button', { name: 'Create a Brand theme' }));
    await screen.findByText(/matches your brand colours/);
    first.unmount();

    const saved = (await storage.profile.get())!;
    const moved = { ...saved, brand: { ...brand, primary: '#0F766E' } };
    await storage.profile.save(moved);
    render(view(moved));
    await userEvent.click(await screen.findByRole('button', { name: 'Update brand theme' }));
    expect(await screen.findByText('Updated "Asha Rao brand" to your new brand colours.')).toBeInTheDocument();
    const themes = await storage.themes.list();
    expect(themes).toHaveLength(1);
    expect(themes[0]?.accent).toBe('#0F766E');
  });

  it('does not offer to overwrite a theme the person edited, only a new one', async () => {
    const { storage, view, profile } = await setup();
    const first = render(view(profile));
    await userEvent.click(await screen.findByRole('button', { name: 'Create a Brand theme' }));
    await screen.findByText(/matches your brand colours/);
    first.unmount();

    const [theme] = await storage.themes.list();
    await storage.themes.save({ ...theme!, fontId: 'poppins' });
    const moved = { ...(await storage.profile.get())!, brand: { ...brand, primary: '#0F766E' } };
    await storage.profile.save(moved);
    render(view(moved));
    expect(await screen.findByText(/you edited/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update brand theme' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create a new Brand theme' }));
    await screen.findByText(/Created the theme "Asha Rao brand 2"/);
    const themes = await storage.themes.list();
    expect(themes.find((entry) => entry.id === theme?.id)).toMatchObject({ accent: '#7C2D12', fontId: 'poppins' });
    expect(themes).toHaveLength(2);
  });

  it('shows why a brand theme could not be made when the colours are hard to read', async () => {
    const { view } = await setup(makeSeller({ name: 'Pale', brand: { primary: '#FFE08A' } }));
    render(view(makeSeller({ name: 'Pale', brand: { primary: '#FFE08A' } })));
    await userEvent.click(await screen.findByRole('button', { name: 'Create a Brand theme' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/accent/i);
  });
});
