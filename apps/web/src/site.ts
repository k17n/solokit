import { getTools, toolHref } from '@solokit/registry';
import { IN_RULES_AS_OF, getCountries } from '@solokit/tax-engines';
import type { SiteFooterProps, SiteHeaderProps } from '@solokit/ui';

export const HEADER_PROPS: SiteHeaderProps = {
  links: [
    { label: 'Tools', href: '/#tools' },
    { label: 'Your business', href: '/business/' },
    { label: 'Privacy', href: '/privacy/' },
  ],
  // Several tools share the site, so the call to action does not name one.
  cta: { label: 'Open a tool', href: '/#tools' },
};

export function getFooterProps(): SiteFooterProps {
  return {
    tools: getTools().map((tool) => ({ label: tool.name, href: toolHref(tool.slug), status: tool.status })),
    countries: getCountries().map((country) => ({ code: country.code, name: country.name, status: country.status })),
    projectLinks: [
      { label: 'Home', href: '/' },
      { label: 'Your business', href: '/business/' },
      { label: 'Privacy', href: '/privacy/' },
    ],
    rulesAsOf: IN_RULES_AS_OF,
  };
}
