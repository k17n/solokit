import type { FeatureId } from './features';

/** Places in the public app where a plugin may show its own interface. Adding a slot is a minor version; removing or renaming one is a major version. */
export interface SlotContexts {
  /** Next to Duplicate and Cancel on an issued invoice, quotation or proforma. */
  'invoice.viewer.actions': { documentId: string; kind: string };
  /** Next to Duplicate on an agreement. */
  'contract.viewer.actions': { documentId: string; kind: string; final: boolean };
  /** The Plans section of the Business page. */
  'business.plans': Record<string, never>;
}

export type SlotName = keyof SlotContexts;

export interface SlotInfo {
  name: SlotName;
  description: string;
  /** The paid features an honest "coming soon" placeholder would stand in for, when upsell is on. */
  upsellFeatures: readonly FeatureId[];
}

export const SLOTS: readonly SlotInfo[] = [
  { name: 'invoice.viewer.actions', description: 'Actions on an issued invoice', upsellFeatures: ['hosted-invoice-links', 'email-sending', 'payment-links'] },
  { name: 'contract.viewer.actions', description: 'Actions on an agreement', upsellFeatures: ['hosted-invoice-links', 'e-sign'] },
  { name: 'business.plans', description: 'Plans section of the Business page', upsellFeatures: ['cloud-sync', 'brand-kit-sync', 'team-members'] },
];

export function getSlot(name: string): SlotInfo | undefined {
  return SLOTS.find((slot) => slot.name === name);
}

/** Slot name to component. `TComponent` is the host's component type (the platform package has no UI library). */
export type SlotRegistry<TComponent = unknown> = Partial<Record<SlotName, TComponent>>;
