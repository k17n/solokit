import type { ThemeLayout } from '@solokit/tool-invoice';

export interface LayoutSpec {
  /** plain: seller left, title right. band: full-width coloured band. centered: title centred between rules. sidebar: coloured edge strip. */
  header: 'plain' | 'band' | 'centered' | 'sidebar';
  uppercaseTitle: boolean;
  titleSize: number;
  /** line: accent text over an accent rule. fill: white text on an accent fill. tint: accent text on a light tint. */
  tableHeader: 'line' | 'fill' | 'tint';
  zebra: boolean;
  rules: 'single' | 'double' | 'none';
  /** Draw the grand total inside a tinted box. */
  totalsBox: boolean;
  /** Draw a thin border around the "bill to" block. */
  partiesBox: boolean;
}

export const LAYOUTS: Record<ThemeLayout, LayoutSpec> = {
  classic: { header: 'plain', uppercaseTitle: false, titleSize: 22, tableHeader: 'line', zebra: false, rules: 'single', totalsBox: false, partiesBox: false },
  modern: { header: 'band', uppercaseTitle: false, titleSize: 24, tableHeader: 'fill', zebra: true, rules: 'none', totalsBox: false, partiesBox: false },
  minimal: { header: 'plain', uppercaseTitle: true, titleSize: 14, tableHeader: 'line', zebra: false, rules: 'single', totalsBox: false, partiesBox: false },
  bold: { header: 'band', uppercaseTitle: false, titleSize: 30, tableHeader: 'fill', zebra: false, rules: 'none', totalsBox: true, partiesBox: false },
  consultant: { header: 'sidebar', uppercaseTitle: false, titleSize: 22, tableHeader: 'tint', zebra: true, rules: 'none', totalsBox: true, partiesBox: false },
  formal: { header: 'centered', uppercaseTitle: true, titleSize: 18, tableHeader: 'line', zebra: false, rules: 'double', totalsBox: false, partiesBox: true },
};
