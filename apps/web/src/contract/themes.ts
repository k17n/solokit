import type { Contract } from '@solokit/tool-contract';
import { DEFAULT_THEME_ID, resolveTheme, type InvoiceSettings, type InvoiceTheme } from '@solokit/tool-invoice';

/** The look of the exported documents: the agreement's own theme if it has one, else the default from the invoice tool's settings. */
export function themeFor(contract: Pick<Contract, 'themeId'>, settings: Pick<InvoiceSettings, 'defaultThemeId'> | undefined, custom: readonly InvoiceTheme[]): InvoiceTheme {
  return resolveTheme(contract.themeId ?? settings?.defaultThemeId ?? DEFAULT_THEME_ID, custom);
}
