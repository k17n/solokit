import { getTools, type ToolDefinition } from '@solokit/registry';
import { deepLinkHref } from '../app-shell/deepLinks';
import { toolAppHref } from '../paths';

/** Something the app home can offer: start a document, open a tool, or a tool that is coming. */
export interface SearchItem {
  id: string;
  kind: 'action' | 'tool' | 'soon';
  label: string;
  description: string;
  /** Where it goes. Coming-soon tools go nowhere yet. */
  href?: string;
  /** The tool it belongs to, for its icon. */
  tool: ToolDefinition;
  keywords: readonly string[];
}

interface Action {
  tool: string;
  /** The kind of document the tool starts, as the tool names it. */
  kind: string;
  label: string;
  description: string;
  keywords: readonly string[];
}

/** The documents the app home can start in one click, in the order shown. */
const ACTIONS: readonly Action[] = [
  { tool: 'invoice', kind: 'invoice', label: 'New invoice', description: 'Bill a client for work done', keywords: ['bill', 'tax invoice', 'GST', 'bill of supply'] },
  { tool: 'invoice', kind: 'quote', label: 'New quotation', description: 'Send a price offer before the work', keywords: ['quote', 'estimate', 'price'] },
  { tool: 'invoice', kind: 'proforma', label: 'New proforma invoice', description: 'Ask for payment before you start', keywords: ['advance', 'proforma'] },
  { tool: 'contract', kind: 'nda-mutual', label: 'New mutual NDA', description: 'Both sides share confidential information', keywords: ['NDA', 'non-disclosure', 'confidentiality'] },
  { tool: 'contract', kind: 'nda-one-way', label: 'New one-way NDA', description: 'Only one side shares secrets', keywords: ['NDA', 'non-disclosure', 'confidentiality'] },
  { tool: 'contract', kind: 'services', label: 'New services agreement', description: 'Scope, fees and ownership for a freelance project', keywords: ['contract', 'agreement', 'freelance', 'scope'] },
];

/** Every quick action, tool and coming-soon tool, for the ready tools in the registry. */
export function searchCatalogue(): SearchItem[] {
  const tools = getTools();
  const ready = new Map(tools.filter((tool) => tool.status === 'available').map((tool) => [tool.slug, tool]));
  const actions: SearchItem[] = ACTIONS.flatMap((action) => {
    const tool = ready.get(action.tool);
    if (!tool) return [];
    return [{ id: `new-${action.kind}`, kind: 'action' as const, label: action.label, description: action.description, href: deepLinkHref(tool.slug, { new: action.kind }), tool, keywords: action.keywords }];
  });
  const toolItems: SearchItem[] = tools.map((tool) => ({
    id: `tool-${tool.slug}`,
    kind: tool.status === 'available' ? ('tool' as const) : ('soon' as const),
    label: tool.name,
    description: tool.tagline,
    ...(tool.status === 'available' ? { href: toolAppHref(tool.slug) } : {}),
    tool,
    keywords: tool.keywords ?? [],
  }));
  return [...actions, ...toolItems];
}

/** The quick actions, in the order shown on the app home. */
export const quickActions = (): SearchItem[] => searchCatalogue().filter((item) => item.kind === 'action');

const norm = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ');

/**
 * What matches a search, best first. Every word typed must appear in the label, the description or a keyword. A match in
 * the label counts most (at its start most of all), then a keyword, then the description; ready things come before
 * tools that are coming.
 */
export function search(query: string, items: readonly SearchItem[] = searchCatalogue()): SearchItem[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored = items.flatMap((item, index) => {
    const label = norm(item.label);
    const keywords = item.keywords.map(norm).join(' | ');
    const description = norm(item.description);
    let score = 0;
    for (const word of words) {
      if (label.split(' ').some((part) => part.startsWith(word))) score += 4;
      else if (label.includes(word)) score += 3;
      else if (keywords.includes(word)) score += 2;
      else if (description.includes(word)) score += 1;
      else return [];
    }
    if (item.kind === 'soon') score -= 0.5;
    return [{ item, score, index }];
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map(({ item }) => item);
}
