import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './downloads';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { invoiceFileName } from './fileName';

afterEach(() => vi.restoreAllMocks());

describe('downloadBlob', () => {
  it('clicks a temporary link with the file name and then cleans up', () => {
    const create = vi.fn().mockReturnValue('blob:fake-1');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    downloadBlob(new Blob(['x'], { type: 'application/pdf' }), 'Invoice-1.pdf');
    expect(create).toHaveBeenCalledOnce();
    expect(clicked).toEqual([{ href: 'blob:fake-1', download: 'Invoice-1.pdf' }]);
    expect(revoke).toHaveBeenCalledWith('blob:fake-1');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

describe('invoiceFileName', () => {
  it('names a regular seller\'s invoice a Tax Invoice', () => {
    expect(invoiceFileName(makeInvoice())).toBe('Tax-Invoice-2026-27-0001.pdf');
  });

  it('names a composition seller\'s invoice a Bill of Supply', () => {
    expect(invoiceFileName(makeInvoice({ seller: makeSeller({ gstStatus: 'composition' }) }))).toBe('Bill-of-Supply-2026-27-0001.pdf');
  });

  it('names a proforma a Proforma Invoice', () => {
    expect(invoiceFileName(makeInvoice({ kind: 'proforma' }))).toBe('Proforma-Invoice-2026-27-0001.pdf');
  });

  it('turns an odd number into a safe file name', () => {
    expect(invoiceFileName(makeInvoice({ number: 'INV 1/' }))).toBe('Tax-Invoice-INV-1.pdf');
  });

  it('falls back to a plain name for an invoice that cannot be built', () => {
    expect(invoiceFileName(makeInvoice({ lines: [{ ...makeInvoice().lines[0]!, rate: -100 }] }))).toBe('invoice.pdf');
  });
});
