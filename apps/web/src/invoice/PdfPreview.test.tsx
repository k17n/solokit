import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeInvoice } from '@solokit/tool-invoice/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfPreview } from './PdfPreview';
import { usePdfPreview, type PdfRenderer } from './usePdfPreview';

const theme = PRESET_THEMES[0]!;
const invoice = makeInvoice();
let counter = 0;

beforeEach(() => {
  counter = 0;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:fake-${++counter}`),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => vi.useRealTimers());

const blob = () => new Blob(['pdf'], { type: 'application/pdf' });

describe('usePdfPreview', () => {
  it('stays idle until it is enabled and has an invoice', () => {
    const render_ = vi.fn<PdfRenderer>().mockResolvedValue(blob());
    const { result } = renderHook(() => usePdfPreview({ invoice: null, theme, enabled: true, delayMs: 0, render: render_ }));
    expect(result.current.status).toBe('idle');
    const off = renderHook(() => usePdfPreview({ invoice, theme, enabled: false, delayMs: 0, render: render_ }));
    expect(off.result.current.status).toBe('idle');
    expect(render_).not.toHaveBeenCalled();
  });

  it('renders after the delay and exposes a blob URL', async () => {
    const render_ = vi.fn<PdfRenderer>().mockResolvedValue(blob());
    const { result } = renderHook(() => usePdfPreview({ invoice, theme, enabled: true, delayMs: 0, render: render_ }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.url).toBe('blob:fake-1');
    expect(render_).toHaveBeenCalledWith({ invoice, theme });
  });

  it('waits for the user to stop typing before rendering', async () => {
    vi.useFakeTimers();
    const render_ = vi.fn<PdfRenderer>().mockResolvedValue(blob());
    const { rerender } = renderHook(({ inv }) => usePdfPreview({ invoice: inv, theme, enabled: true, delayMs: 500, render: render_ }), {
      initialProps: { inv: invoice },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ inv: { ...invoice, notes: 'changed' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(render_).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(render_).toHaveBeenCalledTimes(1);
  });

  it('revokes the old URL when a new one replaces it, and on unmount', async () => {
    const render_ = vi.fn<PdfRenderer>().mockImplementation(async () => blob());
    const { result, rerender, unmount } = renderHook(({ inv }) => usePdfPreview({ invoice: inv, theme, enabled: true, delayMs: 0, render: render_ }), {
      initialProps: { inv: invoice },
    });
    await waitFor(() => expect(result.current.url).toBe('blob:fake-1'));
    rerender({ inv: { ...invoice, notes: 'second' } });
    await waitFor(() => expect(result.current.url).toBe('blob:fake-2'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-2');
  });

  it('drops the PDF when the invoice becomes unavailable, so a stale one is not shown', async () => {
    const render_ = vi.fn<PdfRenderer>().mockImplementation(async () => blob());
    const { result, rerender } = renderHook(
      ({ inv, on }: { inv: typeof invoice | null; on: boolean }) => usePdfPreview({ invoice: inv, theme, enabled: on, delayMs: 0, render: render_ }),
      { initialProps: { inv: invoice as typeof invoice | null, on: true } },
    );
    await waitFor(() => expect(result.current.url).toBe('blob:fake-1'));
    rerender({ inv: null, on: true });
    await waitFor(() => expect(result.current.url).toBeNull());
    expect(result.current.status).toBe('idle');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1');
    rerender({ inv: invoice, on: true });
    await waitFor(() => expect(result.current.url).toBe('blob:fake-2'));
    rerender({ inv: invoice, on: false });
    await waitFor(() => expect(result.current.url).toBeNull());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-2');
  });

  it('ignores a slow render that was overtaken by a newer one', async () => {
    let finishFirst: (value: Blob) => void = () => {};
    const render_ = vi
      .fn<PdfRenderer>()
      .mockImplementationOnce(() => new Promise<Blob>((resolve) => (finishFirst = resolve)))
      .mockImplementation(async () => blob());
    const { result, rerender } = renderHook(({ inv }) => usePdfPreview({ invoice: inv, theme, enabled: true, delayMs: 0, render: render_ }), {
      initialProps: { inv: invoice },
    });
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));
    rerender({ inv: { ...invoice, notes: 'newer' } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const urlBefore = result.current.url;
    await act(async () => finishFirst(blob()));
    expect(result.current.url).toBe(urlBefore);
  });

  it('reports a render error in plain words and can try again', async () => {
    const render_ = vi.fn<PdfRenderer>().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(blob());
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePdfPreview({ invoice, theme, enabled: true, delayMs: 0, render: render_ }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('The PDF could not be built. Try again.');
    expect(spy).toHaveBeenCalled();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    spy.mockRestore();
  });

  it('says so when the PDF tools could not be loaded', async () => {
    const chunkError = Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' });
    const render_ = vi.fn<PdfRenderer>().mockRejectedValue(chunkError);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePdfPreview({ invoice, theme, enabled: true, delayMs: 0, render: render_ }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('The PDF tools could not be loaded. Check your connection and try again.');
  });
});

describe('PdfPreview', () => {
  const base = { filename: 'Tax-Invoice-2026-27-0001.pdf', onRetry: () => {}, placeholder: 'Fill in the details to see the preview.' };

  it('shows the placeholder when idle', () => {
    render(<PdfPreview state={{ status: 'idle', url: null, error: null, retry: () => {} }} {...base} />);
    expect(screen.getByText('Fill in the details to see the preview.')).toBeInTheDocument();
    expect(screen.queryByTitle('Invoice preview')).not.toBeInTheDocument();
  });

  it('shows progress while rendering', () => {
    render(<PdfPreview state={{ status: 'rendering', url: null, error: null, retry: () => {} }} {...base} />);
    expect(screen.getByText('Building the preview…')).toBeInTheDocument();
  });

  it('shows the PDF with an open link and a download link when ready', () => {
    render(<PdfPreview state={{ status: 'ready', url: 'blob:fake', error: null, retry: () => {} }} {...base} />);
    expect(screen.getByTitle('Invoice preview')).toHaveAttribute('src', 'blob:fake');
    const open = screen.getByRole('link', { name: 'Open in a new tab' });
    expect(open).toHaveAttribute('href', 'blob:fake');
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('download', 'Tax-Invoice-2026-27-0001.pdf');
  });

  it('keeps showing the last good PDF while a newer one is being built', () => {
    render(<PdfPreview state={{ status: 'rendering', url: 'blob:old', error: null, retry: () => {} }} {...base} />);
    expect(screen.getByTitle('Invoice preview')).toHaveAttribute('src', 'blob:old');
    expect(screen.getByText('Updating the preview…')).toBeInTheDocument();
  });

  it('shows the error with a Try again button', async () => {
    const onRetry = vi.fn();
    render(<PdfPreview state={{ status: 'error', url: null, error: 'The PDF could not be built. Try again.', retry: onRetry }} {...base} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The PDF could not be built. Try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
