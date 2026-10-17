import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from '../app/privacy/page';

describe('privacy page', () => {
  it('explains where data lives and what that means', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What stays on your device' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What we do not collect' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Back up your data' })).toBeInTheDocument();
    expect(screen.getByText(/clearing your browser data/i)).toBeInTheDocument();
    expect(screen.getByText(/separate database in your browser/i)).toBeInTheDocument();
    expect(screen.getByText(/erases its data from this device only/i)).toBeInTheDocument();
  });

  it('says honestly that visits are counted, what is counted, and how to opt out', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Counting visits' })).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare Web Analytics/)).toBeInTheDocument();
    expect(screen.getAllByText(/without cookies/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not store your IP address/i)).toBeInTheDocument();
    expect(screen.getByText(/Do Not Track or Global Privacy Control/)).toBeInTheDocument();
    expect(screen.getByText(/which page, the page you came from, your country, and the type of device and browser/i)).toBeInTheDocument();
    expect(screen.getByText(/never anything you type/i)).toBeInTheDocument();
  });

  it('no longer claims that there are no analytics', () => {
    render(<PrivacyPage />);
    expect(screen.queryByText(/no analytics scripts/i)).toBeNull();
    expect(screen.queryByText(/never needs to leave your device/i)).toBeNull();
  });
});
