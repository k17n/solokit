export type ToolCategory = 'money' | 'clients' | 'marketing' | 'productivity' | 'documents';
export type ToolStatus = 'available' | 'coming-soon';

export interface ToolDefinition {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  featured?: boolean;
  /** A short name for the app's navigation, such as "Invoices". Ready tools need one. */
  navLabel?: string;
  /** Other words people search for this tool by, beyond its name and tagline ("bill", "NDA"). */
  keywords?: readonly string[];
}

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  money: 'Money',
  clients: 'Client work',
  marketing: 'Marketing',
  productivity: 'Productivity',
  documents: 'Documents',
};

const TOOLS: readonly ToolDefinition[] = [
  {
    slug: 'invoice',
    name: 'Invoice generator',
    tagline: 'GST-ready invoices and quotations in minutes',
    description:
      'Create tax invoices, bills of supply, proforma invoices and quotations for India, each with its own numbers. Works for GST-registered, composition and unregistered sellers, with TDS, advances and export invoices for consultants. Turn a quotation into an invoice when the client says yes.',
    category: 'money',
    status: 'available',
    featured: true,
    navLabel: 'Invoices',
    keywords: ['bill', 'tax invoice', 'quotation', 'quote', 'estimate', 'proforma', 'GST', 'bill of supply', 'receipt', 'payment'],
  },
  {
    slug: 'rate-calculator',
    name: 'Hourly rate calculator',
    tagline: 'Work out what to charge from what you need to earn',
    description: 'Turn your income goal, expenses, taxes and billable hours into an hourly or daily rate.',
    category: 'money',
    status: 'coming-soon',
    keywords: ['pricing', 'rate', 'how much to charge', 'day rate'],
  },
  {
    slug: 'contract',
    name: 'Contract and NDA generator',
    tagline: 'Plain-English NDAs and freelance agreements, ready to review',
    description:
      'Make a mutual or one-way NDA, or a freelance services agreement, in plain English. Answer a few questions, check a summary of your choices, and download a PDF, an editable Word file, or a review pack to send to your lawyer. A template, not legal advice.',
    category: 'clients',
    status: 'available',
    navLabel: 'Agreements',
    keywords: ['NDA', 'non-disclosure', 'confidentiality', 'agreement', 'contract', 'freelance', 'services agreement', 'legal'],
  },
  {
    slug: 'time-tracker',
    name: 'Time tracker',
    tagline: 'Log hours and send them straight to an invoice',
    description: 'Track time per client and project, then turn a timesheet into invoice line items.',
    category: 'clients',
    status: 'coming-soon',
    keywords: ['timesheet', 'hours', 'timer'],
  },
  {
    slug: 'qr-code',
    name: 'QR code generator',
    tagline: 'UPI, Wi-Fi, links and contact cards',
    description: 'Make QR codes for payment links, websites, Wi-Fi and contact details, and download them as PNG or SVG.',
    category: 'marketing',
    status: 'coming-soon',
    keywords: ['UPI', 'payment link', 'wifi', 'vCard'],
  },
  {
    slug: 'email-signature',
    name: 'Email signature generator',
    tagline: 'A clean signature in a minute',
    description: 'Pick a layout, add your details and logo, and copy a signature that works in any email app.',
    category: 'marketing',
    status: 'coming-soon',
    keywords: ['email', 'signature', 'branding'],
  },
];

/** Every tool, with the ones that are ready first and the coming-soon ones after, each group in listed order. */
export function getTools(): ToolDefinition[] {
  const copies = TOOLS.map((tool) => ({ ...tool }));
  return [
    ...copies.filter((tool) => tool.status === 'available'),
    ...copies.filter((tool) => tool.status !== 'available'),
  ];
}

export function getAvailableTools(): ToolDefinition[] {
  return getTools().filter((tool) => tool.status === 'available');
}

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return getTools().find((tool) => tool.slug === slug);
}

export function toolHref(slug: string): string {
  return `/tools/${slug}/`;
}
