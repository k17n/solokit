import { Badge } from './Badge';
import { BackToTop } from './BackToTop';
import { BRAND } from './brand';
import { formatIsoDate } from './format';
import type { NavLink } from './SiteHeader';
import styles from './SiteFooter.module.css';

export interface FooterTool {
  label: string;
  href: string;
  status: 'available' | 'coming-soon';
}

export interface FooterCountry {
  code: string;
  name: string;
  status: 'available' | 'coming-soon';
}

export interface SiteFooterProps {
  tools: FooterTool[];
  countries: FooterCountry[];
  projectLinks: NavLink[];
  /** ISO date the tax rules were last checked. */
  rulesAsOf: string;
}

export function SiteFooter({ tools, countries, projectLinks, rulesAsOf }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.top}`}>
        <div className={styles.pitch}>
          <p className={styles.pitchTitle}>Your paperwork stays on your device.</p>
          <p className={styles.pitchBody}>
            {BRAND.name} runs in your browser. There is no account to make and nothing is uploaded, and it keeps
            working without internet.
          </p>
          <BackToTop />
        </div>

        <nav aria-label="Tools" className={styles.col}>
          <h2 className={styles.heading}>Tools</h2>
          <ul className={styles.list}>
            {tools.map((tool) => (
              <li key={tool.href}>
                {tool.status === 'available' ? (
                  <a href={tool.href}>{tool.label}</a>
                ) : (
                  <>
                    <span className={styles.muted}>{tool.label}</span>
                    <Badge tone="soon">Coming soon</Badge>
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <section aria-label="Countries" className={styles.col}>
          <h2 className={styles.heading}>Countries</h2>
          <ul className={styles.list}>
            {countries.map((country) => (
              <li key={country.code}>
                <span className={country.status === 'available' ? undefined : styles.muted}>{country.name}</span>
                {country.status === 'available' ? (
                  <Badge tone="success">Available</Badge>
                ) : (
                  <Badge tone="soon">Coming soon</Badge>
                )}
              </li>
            ))}
          </ul>
        </section>

        <nav aria-label="Project" className={styles.col}>
          <h2 className={styles.heading}>Project</h2>
          <ul className={styles.list}>
            {projectLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={`container ${styles.legal}`}>
        <p>
          Tax rules last checked {formatIsoDate(rulesAsOf)}. This is not tax advice; confirm with your chartered
          accountant.
        </p>
        <p className={styles.made}>
          <span className={styles.flag} aria-hidden="true" />
          Made in India
        </p>
      </div>

      <div className={styles.wordmark} aria-hidden="true">
        {BRAND.name}
      </div>
    </footer>
  );
}
