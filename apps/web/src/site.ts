import { getTools, toolHref } from '@solokit/registry';
import { IN_RULES_AS_OF, getCountries } from '@solokit/tax-engines';
import type { SiteFooterProps, SiteHeaderProps } from '@solokit/ui';

export const HEADER_PROPS: SiteHeaderProps = {
  links: [
    { label: 'Tools', href: '/#tools' },
    { label: 'Privacy', href: '/privacy/' },
  ],
  cta: { label: 'Create an invoice', href: toolHref('invoice') },
};

export function getFooterProps(): SiteFooterProps {
  return {
    tools: getTools().map((tool) => ({ label: tool.name, href: toolHref(tool.slug), status: tool.status })),
    countries: getCountries().map((country) => ({ code: country.code, name: country.name, status: country.status })),
    projectLinks: [
      { label: 'Home', href: '/' },
      { label: 'Privacy', href: '/privacy/' },
    ],
    rulesAsOf: IN_RULES_AS_OF,
  };
}
