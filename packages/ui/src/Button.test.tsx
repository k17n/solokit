import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders a button element by default', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-variant', 'primary');
  });

  it('renders a link when given an href', () => {
    render(
      <Button href="/tools/invoice/" variant="secondary">
        Create an invoice
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Create an invoice' });
    expect(link).toHaveAttribute('href', '/tools/invoice/');
    expect(link).toHaveAttribute('data-variant', 'secondary');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
