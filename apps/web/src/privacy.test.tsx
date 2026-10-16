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
});
