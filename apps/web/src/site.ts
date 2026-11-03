import { getTools, toolHref } from '@solokit/registry';
import { IN_RULES_AS_OF, getCountries } from '@solokit/tax-engines';
import type { SiteFooterProps, SiteHeaderProps } from '@solokit/ui';
import { APP_HOME } from './paths';

export const REPO_URL = 'https://github.com/k17n/solokit';
/** Opens GitHub's "new issue" page with the tool request form already chosen. */
export const REQUEST_TOOL_URL = `${REPO_URL}/issues/new?template=tool-request.yml`;

export const HEADER_PROPS: SiteHeaderProps = {
  links: [
    { label: 'Tools', href: '/#tools' },
    { label: 'How it works', href: '/#local' },
    { label: 'Privacy', href: '/privacy/' },
  ],
  // Several tools share the site, so the call to action does not name one: it opens the app home, which runs the
  // business setup first for a new visitor and then lists the tools.
  cta: { label: 'Get started', href: APP_HOME },
  github: { label: 'Star on GitHub', href: REPO_URL, external: true },
};

export function getFooterProps(): SiteFooterProps {
  return {
    tools: getTools().map((tool) => ({ label: tool.name, href: toolHref(tool.slug), status: tool.status })),
    countries: getCountries().map((country) => ({ code: country.code, name: country.name, status: country.status })),
    projectLinks: [
      { label: 'Home', href: '/' },
      { label: 'Open SoloKit', href: APP_HOME },
      { label: 'Privacy', href: '/privacy/' },
      { label: 'Request a tool', href: REQUEST_TOOL_URL, external: true },
      { label: 'GitHub', href: REPO_URL, external: true },
    ],
    rulesAsOf: IN_RULES_AS_OF,
  };
}

/**
 * Shows an honest "Available in a paid plan (coming soon)" placeholder where a paid feature would be. Off: the free app
 * says nothing about plans until there is something to sell.
 */
export const SHOW_UPSELL = false;
