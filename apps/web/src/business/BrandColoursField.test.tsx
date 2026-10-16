import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { PaletteDeps } from '@solokit/profile';
import { BrandColoursField, NO_BRAND, contrastChecks, type BrandFormValue } from './BrandColoursField';
import { BLUE_LOGO, RED_LOGO, fakePaletteDeps } from './testDeps';

const LOGO = 'data:image/png;base64,AAAA';

function Harness({ initial = NO_BRAND, logo = LOGO, deps }: { initial?: BrandFormValue; logo?: string; deps?: PaletteDeps | null }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <BrandColoursField logoDataUrl={logo} value={value} onChange={setValue} {...(deps !== undefined ? { deps } : {})} />
      <output data-testid="source">{value.source}</output>
    </>
  );
}

describe('BrandColoursField', () => {
  it('shows the colours found in the logo as swatches with a text list of hex values', async () => {
    render(<Harness deps={fakePaletteDeps(RED_LOGO, [[255, 255, 255], 100])} />);
    const list = await screen.findByRole('list', { name: 'Colours found in your logo' });
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toHaveTextContent(/#[0-9A-F]{6}/);
    expect(items[0]).toHaveTextContent(/\d+% of the logo/);
    expect(screen.getByText(/Suggested brand colours: accent/)).toBeInTheDocument();
  });

  it('fills the colours from the logo, records the source as the logo, and shows passing readability checks', async () => {
    render(<Harness deps={fakePaletteDeps(RED_LOGO)} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Use my logo colours' }));
    expect((screen.getByLabelText('Accent colour') as HTMLInputElement).value).toMatch(/^#[0-9A-F]{6}$/);
    expect(screen.getByTestId('source')).toHaveTextContent('logo');
    expect(screen.getByText('These colours came from your logo.')).toBeInTheDocument();
    const checks = screen.getByRole('list', { name: 'Readability checks' });
    expect(within(checks).getAllByRole('listitem')).toHaveLength(3);
    expect(checks).toHaveTextContent(/Passes Text on background: \d+\.\d to 1 \(needs 4\.5 or more\)/);
    expect(checks).not.toHaveTextContent('Fails');
  });

  it('lets the person override a colour by hand, which makes the source manual, and can reset to the suggestion', async () => {
    render(<Harness deps={fakePaletteDeps(BLUE_LOGO)} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Use my logo colours' }));
    const suggestedAccent = (screen.getByLabelText('Accent colour') as HTMLInputElement).value;
    expect(screen.queryByRole('button', { name: 'Reset to suggestion' })).not.toBeInTheDocument();
    const accent = screen.getByLabelText('Accent colour');
    await userEvent.clear(accent);
    await userEvent.type(accent, '#7c2d12');
    expect(screen.getByTestId('source')).toHaveTextContent('manual');
    expect(screen.getByText('These colours were set by hand.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset to suggestion' }));
    expect(screen.getByLabelText('Accent colour')).toHaveValue(suggestedAccent);
    expect(screen.getByTestId('source')).toHaveTextContent('logo');
  });

  it('reports failing contrast in words', () => {
    render(<Harness initial={{ primary: '#FFE08A', secondary: '', text: '#CCCCCC', background: '#FFFFFF', source: 'manual' }} logo="" />);
    const checks = screen.getByRole('list', { name: 'Readability checks' });
    expect(checks).toHaveTextContent(/Fails Text on background/);
    expect(checks).toHaveTextContent(/Fails White text on accent/);
  });

  it('says so when the logo colours cannot be read, and still allows typing colours', async () => {
    render(<Harness deps={null} />);
    expect(await screen.findByText(/could not be read here/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use my logo colours' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Accent colour'), '0B1B3A');
    expect(screen.getByTestId('source')).toHaveTextContent('manual');
  });

  it('asks for a logo first when there is none, and can clear colours that were typed', async () => {
    render(<Harness logo="" initial={{ ...NO_BRAND, primary: '#0B1B3A', source: 'manual' }} />);
    expect(screen.getByText(/Add a logo above/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear brand colours' }));
    expect(screen.getByLabelText('Accent colour')).toHaveValue('');
    expect(screen.getByTestId('source')).toHaveTextContent('');
  });

  it('marks a value that is not a colour', async () => {
    render(<Harness logo="" />);
    await userEvent.type(screen.getByLabelText('Text colour'), 'blue');
    await waitFor(() => expect(screen.getByLabelText('Text colour')).toHaveAttribute('aria-invalid', 'true'));
  });
});

describe('contrastChecks', () => {
  it('is null until the accent is a colour and uses the default text and background otherwise', () => {
    expect(contrastChecks({ primary: '', text: '', background: '' })).toBeNull();
    const checks = contrastChecks({ primary: '#0B1B3A', text: '', background: '' })!;
    expect(checks.map((check) => check.pass)).toEqual([true, true, true]);
  });
});
