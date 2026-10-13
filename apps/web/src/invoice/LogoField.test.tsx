import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LogoError } from './logo';
import { LogoField } from './LogoField';

const png = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' });

describe('LogoField', () => {
  it('has a labelled file chooser and no preview when there is no logo', () => {
    render(<LogoField value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Logo')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove logo' })).not.toBeInTheDocument();
  });

  it('processes a chosen file and reports the data URL', async () => {
    const onChange = vi.fn();
    const process = vi.fn().mockResolvedValue('data:image/png;base64,OK');
    render(<LogoField value="" onChange={onChange} process={process} />);
    await userEvent.upload(screen.getByLabelText('Logo'), png);
    expect(process).toHaveBeenCalledWith(png);
    expect(onChange).toHaveBeenCalledWith('data:image/png;base64,OK');
  });

  it('shows the current logo and lets it be removed', async () => {
    const onChange = vi.fn();
    render(<LogoField value="data:image/png;base64,AAAA" onChange={onChange} />);
    expect(screen.getByRole('img', { name: 'Your logo' })).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    await userEvent.click(screen.getByRole('button', { name: 'Remove logo' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the reason when a file cannot be used, and keeps the old logo', async () => {
    const onChange = vi.fn();
    const process = vi.fn().mockRejectedValue(new LogoError('Choose a PNG, JPEG, WebP, GIF or SVG image.'));
    render(<LogoField value="data:image/png;base64,OLD" onChange={onChange} process={process} />);
    await userEvent.upload(screen.getByLabelText('Logo'), png);
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a PNG, JPEG, WebP, GIF or SVG image.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a generic message for unexpected errors', async () => {
    const process = vi.fn().mockRejectedValue(new Error('boom'));
    render(<LogoField value="" onChange={() => {}} process={process} />);
    await userEvent.upload(screen.getByLabelText('Logo'), png);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be used');
  });
});
