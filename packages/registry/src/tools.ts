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
    tagline: 'GST-ready invoices in minutes',
    description:
      'Create tax invoices, bills of supply and plain invoices for India. Works for GST-registered, composition and unregistered sellers, with TDS, advances and export invoices for consultants.',
    category: 'money',
    status: 'coming-soon',
    featured: true,
  },
  {
    slug: 'quote',
    name: 'Quote generator',
    tagline: 'Send an estimate, turn it into an invoice later',
    description: 'Build a clear quote with the same details as your invoices, and convert it when the client says yes.',
    category: 'money',
    status: 'coming-soon',
  },
  {
    slug: 'rate-calculator',
    name: 'Hourly rate calculator',
    tagline: 'Work out what to charge from what you need to earn',
    description: 'Turn your income goal, expenses, taxes and billable hours into an hourly or daily rate.',
    category: 'money',
    status: 'coming-soon',
  },
  {
    slug: 'contract',
    name: 'Contract and NDA generator',
    tagline: 'Plain-English agreements for client work',
    description: 'Start from a clear freelance agreement or NDA and fill in the details for each client.',
    category: 'clients',
    status: 'coming-soon',
  },
  {
    slug: 'time-tracker',
    name: 'Time tracker',
    tagline: 'Log hours and send them straight to an invoice',
    description: 'Track time per client and project, then turn a timesheet into invoice line items.',
    category: 'clients',
    status: 'coming-soon',
  },
  {
    slug: 'qr-code',
    name: 'QR code generator',
    tagline: 'UPI, Wi-Fi, links and contact cards',
    description: 'Make QR codes for payment links, websites, Wi-Fi and contact details, and download them as PNG or SVG.',
    category: 'marketing',
    status: 'coming-soon',
  },
  {
    slug: 'email-signature',
    name: 'Email signature generator',
    tagline: 'A clean signature in a minute',
    description: 'Pick a layout, add your details and logo, and copy a signature that works in any email app.',
    category: 'marketing',
    status: 'coming-soon',
  },
];

export function getTools(): ToolDefinition[] {
  return TOOLS.map((tool) => ({ ...tool }));
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
