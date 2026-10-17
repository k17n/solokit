/**
 * Every feature that can be switched on by a plan, as data. The public app only reads this list; it never grants a paid
 * feature itself. Adding a feature is a minor version of this package.
 */
export interface FeatureInfo {
  id: string;
  /** Short name, safe to show in the interface. */
  label: string;
  description: string;
  tier: 'free' | 'paid';
  /** True when the feature cannot work without a server. Browser-only features can never be a real paywall. */
  needsServer: boolean;
}

export const FEATURES = [
  { id: 'cloud-sync', label: 'Cloud sync', description: 'Keep a Business in step across your devices, encrypted before it leaves the device.', tier: 'paid', needsServer: true },
  { id: 'brand-kit-sync', label: 'Brand kit sync', description: 'Logo, colours, fonts and themes shared across devices and team members.', tier: 'paid', needsServer: true },
  { id: 'hosted-invoice-links', label: 'Hosted document links', description: 'Share an invoice or agreement as a link instead of a file, optionally on your own domain.', tier: 'paid', needsServer: true },
  { id: 'email-sending', label: 'Send by email', description: 'Email a document straight from SoloKit.', tier: 'paid', needsServer: true },
  { id: 'payment-reminders', label: 'Automatic payment reminders', description: 'Reminders for overdue invoices, sent for you.', tier: 'paid', needsServer: true },
  { id: 'payment-links', label: 'Payment links', description: 'Let clients pay an invoice online.', tier: 'paid', needsServer: true },
  { id: 'e-sign', label: 'E-signing', description: 'Ask the other party to sign an agreement online.', tier: 'paid', needsServer: true },
  { id: 'e-invoice-irn', label: 'E-invoice IRN', description: 'Get an Invoice Reference Number from the GST e-invoice portal.', tier: 'paid', needsServer: true },
  { id: 'team-members', label: 'Team members', description: 'Invite others to work in the same Business.', tier: 'paid', needsServer: true },
  { id: 'custom-domain', label: 'Custom domain', description: 'Serve hosted links from your own domain.', tier: 'paid', needsServer: true },
  { id: 'local-tools', label: 'Local tools', description: 'Every tool that runs in your browser on your device.', tier: 'free', needsServer: false },
  { id: 'local-backup', label: 'Backup and restore files', description: 'Download and restore a backup file yourself.', tier: 'free', needsServer: false },
] as const satisfies readonly FeatureInfo[];

export type FeatureId = (typeof FEATURES)[number]['id'];

export function getFeature(id: string): FeatureInfo | undefined {
  return FEATURES.find((feature) => feature.id === id);
}

export function isFeatureId(value: string): value is FeatureId {
  return FEATURES.some((feature) => feature.id === value);
}

export function paidFeatures(): FeatureInfo[] {
  return FEATURES.filter((feature) => feature.tier === 'paid');
}
