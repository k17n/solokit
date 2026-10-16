import type { ComponentType } from 'react';
import { ContractToolLoader } from './contract/ContractToolLoader';
import { InvoiceToolLoader } from './invoice/InvoiceToolLoader';

/** Tool pages render the component registered here for their slug. Tools without one show a coming-soon notice. */
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  invoice: InvoiceToolLoader,
  contract: ContractToolLoader,
};
