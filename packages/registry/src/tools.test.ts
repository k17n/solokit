import { describe, expect, it } from 'vitest';
import {
  TOOL_CATEGORY_LABELS,
  getAvailableTools,
  getToolBySlug,
  getTools,
  toolHref,
} from './tools';

describe('tool registry', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = getTools().map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('puts the invoice generator first and features it', () => {
    const [first] = getTools();
    expect(first?.slug).toBe('invoice');
    expect(first?.featured).toBe(true);
  });

  it('gives every tool copy and a known category', () => {
    for (const tool of getTools()) {
      expect(tool.name).not.toBe('');
      expect(tool.tagline).not.toBe('');
      expect(tool.description).not.toBe('');
      expect(TOOL_CATEGORY_LABELS[tool.category]).toBeTruthy();
    }
  });

  it('looks tools up by slug', () => {
    expect(getToolBySlug('invoice')?.name).toBe('Invoice generator');
    expect(getToolBySlug('nope')).toBeUndefined();
  });

  it('has the invoice generator available, and every other tool still coming soon', () => {
    const available = getAvailableTools().map((tool) => tool.slug);
    expect(available).toEqual(['invoice']);
    expect(getToolBySlug('invoice')?.status).toBe('available');
    expect(getToolBySlug('quote')).toBeUndefined();
    expect(getToolBySlug('rate-calculator')?.status).toBe('coming-soon');
  });

  it('builds trailing-slash hrefs', () => {
    expect(toolHref('invoice')).toBe('/tools/invoice/');
  });

  it('returns copies so callers cannot change the registry', () => {
    getTools().pop();
    expect(getTools().length).toBeGreaterThan(1);
  });
});
