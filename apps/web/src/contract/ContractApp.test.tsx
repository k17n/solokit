import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { StoreProvider } from '../store/StoreProvider';
import { ContractApp } from './ContractApp';
import { NOW, fakeExporter } from './testSetup';

function renderApp() {
  const store = createMemoryStore();
  render(
    <StoreProvider factory={() => store}>
      <ContractApp exporter={fakeExporter()} now={() => NOW} />
    </StoreProvider>,
  );
  return store;
}

async function fillAndSave() {
  await userEvent.click(await screen.findByRole('button', { name: /Mutual NDA/ }));
  await userEvent.type(screen.getByLabelText('First Party: full name'), 'Asha Rao Consulting');
  await userEvent.type(screen.getByLabelText('Second Party: full name'), 'Northwind');
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved');
}

describe('ContractApp', () => {
  it('has plain-button tabs with aria-current, and the honest notice on every screen', async () => {
    renderApp();
    const nav = await screen.findByRole('navigation', { name: 'Contract tool' });
    const tabs = within(nav).getAllByRole('button');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Agreements', 'Backup & restore']);
    expect(tabs[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Template, not legal advice.')).toBeInTheDocument();
    await userEvent.click(tabs[1]!);
    expect(tabs[1]).toHaveAttribute('aria-current', 'page');
    expect(tabs[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Template, not legal advice.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
  });

  it('starts an agreement from the cards, keeps the Agreements tab current while editing, and lists the saved draft', async () => {
    renderApp();
    await fillAndSave();
    expect(screen.getByRole('button', { name: 'Agreements' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Back to agreements' }));
    const list = await screen.findByRole('list', { name: 'Agreements' });
    expect(within(list).getByText('Mutual NDA with Northwind')).toBeInTheDocument();
  });

  it('warns when the browser cannot keep data', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <StoreProvider
        factory={() => {
          throw new Error('blocked');
        }}
      >
        <ContractApp />
      </StoreProvider>,
    );
    expect(await screen.findByText('Your browser is not saving data')).toBeInTheDocument();
  });
});
