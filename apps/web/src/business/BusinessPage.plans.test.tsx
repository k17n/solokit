import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPlatform } from '@solokit/platform';
import { PlatformProvider, type SlotComponent } from '../platform/PlatformProvider';
import { WorkspacesProvider } from '../workspace/WorkspaceProvider';
import { BusinessPage } from './BusinessPage';
import { makeManager } from './testWorkspaces';

function renderPage(showUpsell?: boolean) {
  const { manager } = makeManager();
  return render(
    <PlatformProvider platform={createPlatform<SlotComponent<never>>()} {...(showUpsell === undefined ? {} : { showUpsell })}>
      <WorkspacesProvider manager={manager}>
        <BusinessPage />
      </WorkspacesProvider>
    </PlatformProvider>,
  );
}

describe('BusinessPage Plans section', () => {
  it('is not there by default', async () => {
    renderPage();
    await screen.findByRole('heading', { name: /Set up/ });
    expect(screen.queryByRole('heading', { name: 'Plans' })).toBeNull();
  });

  it('appears with an honest placeholder only when upsell is on', async () => {
    renderPage(true);
    expect(await screen.findByRole('heading', { name: 'Plans' })).toBeInTheDocument();
    expect(screen.getByText(/Available in a paid plan \(coming soon\)/)).toBeInTheDocument();
  });
});
