import { PRESET_THEMES, buildInvoiceDocument } from '@solokit/tool-invoice';
import { makeInvoice } from '@solokit/tool-invoice/testing';
import { Children, isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { InvoicePdf } from './InvoicePdf';
import { Watermark } from './sections';

function pageChildren(status: 'draft' | 'issued'): ReactElement[] {
  const doc = buildInvoiceDocument(makeInvoice({ status }));
  const document = InvoicePdf({ doc, theme: PRESET_THEMES[0]! }) as ReactElement<{ children: ReactElement }>;
  const page = document.props.children as ReactElement<{ children: unknown }>;
  return Children.toArray(page.props.children as never).filter(isValidElement) as ReactElement[];
}

describe('Watermark', () => {
  it('is drawn after the page content so opaque fills cannot cut through it', () => {
    const children = pageChildren('draft');
    expect(children[children.length - 1]?.type).toBe(Watermark);
  });

  it('is a fixed, translucent grey stamp', () => {
    const doc = buildInvoiceDocument(makeInvoice({ status: 'draft' }));
    const stamp = Watermark({ doc }) as ReactElement<{ fixed: boolean; style: { opacity: number; color: string } }>;
    expect(stamp.props.fixed).toBe(true);
    expect(stamp.props.style.opacity).toBe(0.12);
    expect(stamp.props.style.color).toBe('#6B7280');
  });

  it('is absent from an issued invoice', () => {
    const doc = buildInvoiceDocument(makeInvoice());
    expect(Watermark({ doc })).toBeNull();
  });
});
