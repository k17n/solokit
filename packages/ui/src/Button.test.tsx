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

  it('merges a custom className onto the element', () => {
    render(<Button className="extra">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('extra');
  });

  it('sets data-variant to ghost for the ghost variant', () => {
    render(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-variant', 'ghost');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
