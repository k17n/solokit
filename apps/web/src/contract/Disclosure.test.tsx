import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Disclosure } from './Disclosure';

const summary = () => screen.getByText('More');
const details = () => summary().closest('details')!;

describe('Disclosure', () => {
  it('starts closed, opens and closes with the reader', async () => {
    render(<Disclosure summary="More">Body</Disclosure>);
    expect(details()).not.toHaveAttribute('open');
    await userEvent.click(summary());
    expect(details()).toHaveAttribute('open');
    await userEvent.click(summary());
    expect(details()).not.toHaveAttribute('open');
  });

  it('starts open when asked to', () => {
    render(
      <Disclosure summary="More" defaultOpen>
        Body
      </Disclosure>,
    );
    expect(details()).toHaveAttribute('open');
  });

  it('does not snap shut when the reason for opening it goes away', async () => {
    const { rerender } = render(
      <Disclosure summary="More" openWhen>
        Body
      </Disclosure>,
    );
    expect(details()).toHaveAttribute('open');
    rerender(
      <Disclosure summary="More" openWhen={false}>
        Body
      </Disclosure>,
    );
    expect(details()).toHaveAttribute('open');
  });

  it('opens when a reason appears, even if the reader had closed it', async () => {
    const { rerender } = render(<Disclosure summary="More">Body</Disclosure>);
    await userEvent.click(summary());
    await userEvent.click(summary());
    expect(details()).not.toHaveAttribute('open');
    rerender(
      <Disclosure summary="More" openWhen>
        Body
      </Disclosure>,
    );
    expect(details()).toHaveAttribute('open');
  });

  it('stays as the reader left it across unrelated re-renders', async () => {
    const { rerender } = render(<Disclosure summary="More">Body</Disclosure>);
    await userEvent.click(summary());
    rerender(<Disclosure summary="More">Body changed</Disclosure>);
    expect(details()).toHaveAttribute('open');
  });
});
