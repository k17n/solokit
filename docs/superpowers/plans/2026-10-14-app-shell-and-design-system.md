# App Shell, Design System and Storage Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the SoloKit website shell: a statically exported, installable, offline-capable Next.js app with the brand design system, a tool registry that drives the home page and tool routes, and a local-first storage layer, ready for the invoice tool in Plan 3.

**Architecture:** Four new workspace packages (`ui`, `registry`, `storage`) plus `apps/web` (Next.js 16, App Router, `output: 'export'`). Workspace packages are plain TypeScript/TSX consumed from source through Next's `transpilePackages`. The home page's hero is a live receipt that runs the real `@solokit/core` and `@solokit/tax-engines` code. A hand-written service worker plus web manifest make the site installable and offline-capable. No backend.

**Tech Stack:** Next.js 16.4, React 19.3, TypeScript 5.x, CSS Modules with CSS custom properties, `next/font/google` (self-hosted at build time), Vitest + jsdom + Testing Library, `fake-indexeddb`.

## Global Constraints

Copied from the spec and Plan 1; every task's requirements include them.

- Monorepo uses **pnpm workspaces** and **TypeScript**. Money is **integer paise**.
- **Local-first**: all user data lives on the device (IndexedDB); no accounts, no server in this phase. Storage sits behind an interface so a sync adapter can be added later.
- **Palette**: ink navy `#0B1B3A`, emerald `#10B981`, warm amber `#F5B54A`, warm off-white `#FAF8F4`. Dark mode via the same tokens (`prefers-color-scheme`).
- **Site fonts** (bundled, self-hosted via `next/font/google`, `latin` + `latin-ext` subsets): Bricolage Grotesque (headlines), Geist (UI text), JetBrains Mono (amounts and numbers). No requests to Google at runtime.
- **Look**: paper-like cards with subtle grain; trust strip "Free · No signup · Works offline · Your data stays on your device"; dark navy footer with a giant cropped wordmark and an emerald-to-amber gradient glow, link columns (Tools, Countries, Project), a "Made in India" line, a privacy statement and an animated "Back to top".
- **Country picker rule**: India is the only available country; every other country shows **"Coming soon"**.
- **Tax disclaimer**: wherever tax rules are mentioned, state they were "last checked <date>", are not tax advice, and should be confirmed with a chartered accountant. The date comes from `IN_RULES_AS_OF`.
- **Quality floor**: responsive down to a 360px phone with 16px side gutters and no horizontal scroll; visible keyboard focus; `prefers-reduced-motion` respected; a skip-to-content link; semantic landmarks.
- The storage interface is named **`DataStore`** (not `Storage`, which is a DOM global type).
- Static export: **`trailingSlash: true`**, so internal links end with `/` (for example `/privacy/`, `/tools/invoice/`).
- Turborepo from the spec stays deferred: there is still only one build target, so plain `pnpm -r` scripts are used.

## File Structure

```
package.json                         (modify: dev/build/preview scripts)
.gitignore                           (modify)
README.md                            (modify)
packages/
  ui/
    package.json  tsconfig.json  vitest.config.ts  vitest.setup.ts
    src/
      index.ts  css.d.ts  tokens.css  brand.ts  format.ts (+ format.test.ts)
      Button.tsx  Button.module.css  Button.test.tsx
      Badge.tsx   Badge.module.css   Badge.test.tsx
      Logo.tsx    Logo.module.css    Logo.test.tsx
      SiteHeader.tsx  SiteHeader.module.css  SiteHeader.test.tsx
      BackToTop.tsx   BackToTop.test.tsx
      SiteFooter.tsx  SiteFooter.module.css  SiteFooter.test.tsx
  registry/
    package.json  tsconfig.json
    src/ index.ts  tools.ts  tools.test.ts
  storage/
    package.json  tsconfig.json
    src/
      index.ts  types.ts  snapshot.ts  snapshot.test.ts
      memory-store.ts  idb-store.ts  contract.ts  stores.test.ts
apps/web/
  package.json  next.config.ts  tsconfig.json  vitest.config.ts  vitest.setup.ts
  app/
    layout.tsx  page.tsx  not-found.tsx  icon.svg
    privacy/page.tsx
    tools/[slug]/page.tsx
  public/
    manifest.webmanifest  sw.js  icons/*.png
  scripts/generate-icons.mjs
  src/
    site.ts  site.test.ts
    pwa.test.ts  ServiceWorkerRegister.tsx  ServiceWorkerRegister.test.tsx
    store/StoreProvider.tsx  store/StoreProvider.test.tsx
    components/
      PageShell.tsx  PageShell.module.css
      ReceiptDemo.tsx  ReceiptDemo.module.css  ReceiptDemo.test.tsx
      computeDemo.ts  computeDemo.test.ts
      Hero.tsx  Hero.module.css
      TrustStrip.tsx  TrustStrip.module.css
      ToolGrid.tsx  ToolGrid.module.css
      LocalSection.tsx  LocalSection.module.css
      home.test.tsx
    tool-page.test.tsx  privacy.test.tsx
```

---

### Task 1: UI package scaffold, design tokens, Button, Badge, Logo

**Files:**
- Create: `packages/ui/package.json`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `packages/ui/src/index.ts`, `css.d.ts`, `tokens.css`, `brand.ts`
- Create: `packages/ui/src/Button.tsx`, `Button.module.css`, `Button.test.tsx`
- Create: `packages/ui/src/Badge.tsx`, `Badge.module.css`, `Badge.test.tsx`
- Create: `packages/ui/src/Logo.tsx`, `Logo.module.css`, `Logo.test.tsx`

**Interfaces:**
- Produces (`@solokit/ui`):
  - `BRAND: { name: 'SoloKit'; first: 'Solo'; second: 'Kit'; tagline: string }`
  - `Button` props: `variant?: 'primary' | 'secondary' | 'ghost'`, `className?`, `children`; renders `<a>` when `href` is given, otherwise `<button type="button">`. The element carries `data-variant`.
  - `Badge` props: `tone?: 'neutral' | 'success' | 'soon'`, `children`
  - `Logo` props: `href?: string` (default `'/'`), `size?: 'md' | 'lg'`
  - Package export `@solokit/ui/tokens.css` (global CSS variables and base styles)

- [ ] **Step 1: Create the package files**

`packages/ui/package.json`:
```json
{
  "name": "@solokit/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens.css"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/ui/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "vitest.setup.ts", "vitest.config.ts"]
}
```

`packages/ui/vitest.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

`packages/ui/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

`packages/ui/src/css.d.ts`:
```ts
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
```

`packages/ui/src/brand.ts`:
```ts
export const BRAND = {
  name: 'SoloKit',
  first: 'Solo',
  second: 'Kit',
  tagline: 'Free tools for one-person businesses',
} as const;
```

- [ ] **Step 2: Write the design tokens and base styles**

`packages/ui/src/tokens.css`:
```css
:root {
  /* palette */
  --ink: #0b1b3a;
  --ink-2: #13294f;
  --paper: #faf8f4;
  --paper-2: #f2eee6;
  --emerald: #10b981;
  --emerald-deep: #047857;
  --amber: #f5b54a;

  /* semantic, light */
  --bg: var(--paper);
  --surface: #ffffff;
  --surface-2: var(--paper-2);
  --text: var(--ink);
  --text-muted: #4a5876;
  --border: #e2dccf;
  --accent: var(--emerald);
  --accent-text: var(--emerald-deep);
  --edge: var(--ink);

  /* paper grain (ink-coloured noise, very faint) */
  --grain: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .04  0 0 0 0 .1  0 0 0 0 .23  0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.07'/></svg>");

  /* type */
  --ff-display: var(--font-display), 'Bricolage Grotesque', system-ui, sans-serif;
  --ff-sans: var(--font-sans), 'Geist', system-ui, sans-serif;
  --ff-mono: var(--font-mono), 'JetBrains Mono', ui-monospace, monospace;

  /* shape and layout */
  --radius-s: 6px;
  --radius-m: 12px;
  --radius-l: 20px;
  --shadow-card: 0 1px 0 rgb(11 27 58 / 0.05), 0 18px 40px -22px rgb(11 27 58 / 0.35);
  --container: 72rem;
  --space-section: clamp(3.5rem, 8vw, 6.5rem);

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a1428;
    --surface: #101e3a;
    --surface-2: #0d1930;
    --text: #eaf0fa;
    --text-muted: #9aabc8;
    --border: #22345a;
    --accent-text: #34d399;
    --edge: #eaf0fa;
    --shadow-card: 0 1px 0 rgb(0 0 0 / 0.3), 0 18px 40px -22px rgb(0 0 0 / 0.7);
    color-scheme: dark;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--ff-sans);
  font-size: 1.0625rem;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1,
h2,
h3 {
  margin: 0;
  font-family: var(--ff-display);
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

p {
  margin: 0;
  text-wrap: pretty;
}

a {
  color: inherit;
}

img,
svg {
  display: block;
  max-width: 100%;
}

:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
  border-radius: 4px;
}

.container {
  width: min(100% - 2rem, var(--container));
  margin-inline: auto;
}

.num {
  font-family: var(--ff-mono);
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  left: 1rem;
  top: -4rem;
  z-index: 100;
  padding: 0.6rem 1rem;
  background: var(--ink);
  color: var(--paper);
  border-radius: var(--radius-s);
}

.skip-link:focus {
  top: 1rem;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Write the failing component tests**

`packages/ui/src/Button.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders a button element by default', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-variant', 'primary');
  });

  it('renders a link when given an href', () => {
    render(
      <Button href="/tools/invoice/" variant="secondary">
        Create an invoice
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Create an invoice' });
    expect(link).toHaveAttribute('href', '/tools/invoice/');
    expect(link).toHaveAttribute('data-variant', 'secondary');
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

`packages/ui/src/Badge.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its text and tone', () => {
    render(<Badge tone="soon">Coming soon</Badge>);
    const badge = screen.getByText('Coming soon');
    expect(badge).toHaveAttribute('data-tone', 'soon');
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toHaveAttribute('data-tone', 'neutral');
  });
});
```

`packages/ui/src/Logo.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('links home and shows the wordmark', () => {
    render(<Logo />);
    const link = screen.getByRole('link', { name: 'SoloKit home' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent('SoloKit');
  });

  it('accepts a custom href', () => {
    render(<Logo href="/privacy/" />);
    expect(screen.getByRole('link', { name: 'SoloKit home' })).toHaveAttribute('href', '/privacy/');
  });
});
```

- [ ] **Step 4: Install and run the tests to verify they fail**

Run: `pnpm install`
Then: `pnpm --filter @solokit/ui test`
Expected: FAIL (cannot resolve `./Button`, `./Badge`, `./Logo`).

- [ ] **Step 5: Implement the components**

`packages/ui/src/Button.tsx`:
```tsx
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost';

interface SharedProps {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

type ButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = SharedProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', className, children, ...rest } = props;
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');

  if (typeof rest.href === 'string') {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} className={classes} data-variant={variant}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} className={classes} data-variant={variant}>
      {children}
    </button>
  );
}
```

`packages/ui/src/Button.module.css`:
```css
.button {
  --btn-bg: var(--accent);
  --btn-fg: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.65rem 1.25rem;
  font: 600 1rem/1 var(--ff-sans);
  letter-spacing: -0.005em;
  text-decoration: none;
  color: var(--btn-fg);
  background: var(--btn-bg);
  border: 1.5px solid var(--edge);
  border-radius: var(--radius-m);
  box-shadow: 0 3px 0 var(--edge);
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    background-color 0.12s ease;
}

.button:hover {
  transform: translateY(1px);
  box-shadow: 0 2px 0 var(--edge);
}

.button:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 var(--edge);
}

.secondary {
  --btn-bg: var(--surface);
  --btn-fg: var(--text);
}

.ghost {
  --btn-bg: transparent;
  --btn-fg: var(--text);
  border-color: transparent;
  box-shadow: none;
}

.ghost:hover {
  background: var(--surface-2);
  transform: none;
  box-shadow: none;
}
```

`packages/ui/src/Badge.tsx`:
```tsx
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps {
  tone?: 'neutral' | 'success' | 'soon';
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span className={styles.badge} data-tone={tone}>
      {children}
    </span>
  );
}
```

`packages/ui/src/Badge.module.css`:
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  font: 500 0.7rem/1.2 var(--ff-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.badge[data-tone='success'] {
  color: var(--accent-text);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.badge[data-tone='soon'] {
  border-color: color-mix(in srgb, var(--amber) 70%, transparent);
  background: color-mix(in srgb, var(--amber) 22%, transparent);
}
```

`packages/ui/src/Logo.tsx`:
```tsx
import { BRAND } from './brand';
import styles from './Logo.module.css';

export interface LogoProps {
  href?: string;
  size?: 'md' | 'lg';
}

export function Logo({ href = '/', size = 'md' }: LogoProps) {
  return (
    <a href={href} className={`${styles.logo} ${styles[size] ?? ''}`} aria-label={`${BRAND.name} home`}>
      <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path className={styles.paper} d="M5 2.5h14v17.2l-2.33-1.6-2.34 1.6L12 18.1l-2.33 1.6-2.34-1.6L5 19.7z" />
        <path className={styles.lines} d="M8.5 8.5h7M8.5 12h4.5" />
      </svg>
      <span className={styles.word}>
        {BRAND.first}
        <span className={styles.kit}>{BRAND.second}</span>
      </span>
    </a>
  );
}
```

`packages/ui/src/Logo.module.css`:
```css
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text);
  text-decoration: none;
}

.md {
  font-size: 1.35rem;
}

.lg {
  font-size: 2rem;
}

.mark {
  width: 1.45em;
  height: 1.45em;
}

.paper {
  fill: var(--text);
}

.lines {
  fill: none;
  stroke: var(--bg);
  stroke-width: 1.6;
  stroke-linecap: round;
}

.word {
  font-family: var(--ff-display);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}

.kit {
  color: var(--accent-text);
}
```

`packages/ui/src/index.ts`:
```ts
export { BRAND } from './brand';
export { Badge, type BadgeProps } from './Badge';
export { Button } from './Button';
export { Logo, type LogoProps } from './Logo';
```

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm --filter @solokit/ui test`
Expected: PASS (Button 3, Badge 2, Logo 2).
Run: `pnpm --filter @solokit/ui typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): add design tokens, Button, Badge and Logo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Site header and the signature footer

**Files:**
- Create: `packages/ui/src/format.ts`, `format.test.ts`
- Create: `packages/ui/src/SiteHeader.tsx`, `SiteHeader.module.css`, `SiteHeader.test.tsx`
- Create: `packages/ui/src/BackToTop.tsx`, `BackToTop.test.tsx`
- Create: `packages/ui/src/SiteFooter.tsx`, `SiteFooter.module.css`, `SiteFooter.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `Badge`, `Button`, `Logo`, `BRAND` from Task 1.
- Produces (`@solokit/ui`):
  - `formatIsoDate(iso: string): string` ("2026-10-13" -> "13 Oct 2026"; throws `RangeError` for anything that is not `YYYY-MM-DD`)
  - `NavLink = { label: string; href: string }`
  - `SiteHeaderProps = { links: NavLink[]; cta: NavLink }`; component `SiteHeader`
  - `BackToTop` (client component, button "Back to top")
  - `FooterTool = { label: string; href: string; status: 'available' | 'coming-soon' }`
  - `FooterCountry = { code: string; name: string; status: 'available' | 'coming-soon' }`
  - `SiteFooterProps = { tools: FooterTool[]; countries: FooterCountry[]; projectLinks: NavLink[]; rulesAsOf: string }`; component `SiteFooter`

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatIsoDate } from './format';

describe('formatIsoDate', () => {
  it('formats an ISO date as day, short month, year', () => {
    expect(formatIsoDate('2026-10-13')).toBe('13 Oct 2026');
    expect(formatIsoDate('2025-09-22')).toBe('22 Sep 2025');
    expect(formatIsoDate('2026-01-05')).toBe('5 Jan 2026');
  });

  it('rejects anything that is not an ISO date', () => {
    expect(() => formatIsoDate('13/10/2026')).toThrow(RangeError);
    expect(() => formatIsoDate('2026-13-01')).toThrow(RangeError);
  });
});
```

`packages/ui/src/SiteHeader.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from './SiteHeader';

const props = {
  links: [
    { label: 'Tools', href: '/#tools' },
    { label: 'Privacy', href: '/privacy/' },
  ],
  cta: { label: 'Create an invoice', href: '/tools/invoice/' },
};

describe('SiteHeader', () => {
  it('shows the logo, primary navigation and the call to action', () => {
    render(<SiteHeader {...props} />);
    expect(screen.getByRole('link', { name: 'SoloKit home' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/#tools');
    expect(within(nav).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
    expect(screen.getByRole('link', { name: 'Create an invoice' })).toHaveAttribute('href', '/tools/invoice/');
  });
});
```

`packages/ui/src/BackToTop.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackToTop } from './BackToTop';

afterEach(() => vi.restoreAllMocks());

describe('BackToTop', () => {
  it('scrolls smoothly to the top', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    render(<BackToTop />);
    await userEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps instantly when the visitor prefers reduced motion', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    render(<BackToTop />);
    await userEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
```

`packages/ui/src/SiteFooter.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './SiteFooter';

const props = {
  tools: [
    { label: 'Invoice generator', href: '/tools/invoice/', status: 'available' as const },
    { label: 'Quote generator', href: '/tools/quote/', status: 'coming-soon' as const },
  ],
  countries: [
    { code: 'IN', name: 'India', status: 'available' as const },
    { code: 'US', name: 'United States', status: 'coming-soon' as const },
  ],
  projectLinks: [
    { label: 'Home', href: '/' },
    { label: 'Privacy', href: '/privacy/' },
  ],
  rulesAsOf: '2026-10-13',
};

describe('SiteFooter', () => {
  it('states the privacy promise and offers a way back to the top', () => {
    render(<SiteFooter {...props} />);
    expect(screen.getByText('Your paperwork stays on your device.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument();
  });

  it('links available tools and marks the rest as coming soon', () => {
    render(<SiteFooter {...props} />);
    const tools = screen.getByRole('navigation', { name: 'Tools' });
    expect(within(tools).getByRole('link', { name: 'Invoice generator' })).toHaveAttribute('href', '/tools/invoice/');
    expect(within(tools).queryByRole('link', { name: 'Quote generator' })).not.toBeInTheDocument();
    expect(within(tools).getByText('Quote generator')).toBeInTheDocument();
    expect(within(tools).getAllByText('Coming soon')).toHaveLength(1);
  });

  it('lists countries with India available and others coming soon', () => {
    render(<SiteFooter {...props} />);
    const countries = screen.getByRole('region', { name: 'Countries' });
    expect(within(countries).getByText('India')).toBeInTheDocument();
    expect(within(countries).getByText('Available')).toBeInTheDocument();
    expect(within(countries).getByText('United States')).toBeInTheDocument();
    expect(within(countries).getByText('Coming soon')).toBeInTheDocument();
  });

  it('shows project links, the tax disclaimer with the date, and the made-in-India line', () => {
    render(<SiteFooter {...props} />);
    const project = screen.getByRole('navigation', { name: 'Project' });
    expect(within(project).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
    expect(screen.getByText(/Tax rules last checked 13 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/not tax advice/i)).toBeInTheDocument();
    expect(screen.getByText('Made in India')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/ui test`
Expected: FAIL (cannot resolve `./format`, `./SiteHeader`, `./BackToTop`, `./SiteFooter`).

- [ ] **Step 3: Implement `format.ts`**

`packages/ui/src/format.ts`:
```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-13" -> "13 Oct 2026". Pure string handling, so time zones cannot shift the day. */
export function formatIsoDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    throw new RangeError(`Expected an ISO date (YYYY-MM-DD), got "${iso}"`);
  }
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`;
}
```

- [ ] **Step 4: Implement the header**

`packages/ui/src/SiteHeader.tsx`:
```tsx
import { Button } from './Button';
import { Logo } from './Logo';
import styles from './SiteHeader.module.css';

export interface NavLink {
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  links: NavLink[];
  cta: NavLink;
}

export function SiteHeader({ links, cta }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />
        <nav aria-label="Primary" className={styles.nav}>
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <Button href={cta.href} className={styles.cta}>
          {cta.label}
        </Button>
      </div>
    </header>
  );
}
```

`packages/ui/src/SiteHeader.module.css`:
```css
.header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-height: 4rem;
}

.nav {
  margin-left: auto;
}

.nav ul {
  display: flex;
  gap: 1.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav a {
  color: var(--text-muted);
  font-weight: 500;
  text-decoration: none;
}

.nav a:hover {
  color: var(--text);
  text-decoration: underline 2px solid var(--amber);
  text-underline-offset: 8px;
}

.cta {
  min-height: 2.5rem;
  padding-block: 0.5rem;
}

@media (max-width: 40rem) {
  .nav {
    display: none;
  }

  .cta {
    margin-left: auto;
  }
}
```

- [ ] **Step 5: Implement BackToTop and the footer**

`packages/ui/src/BackToTop.tsx`:
```tsx
'use client';

import styles from './SiteFooter.module.css';

export function BackToTop() {
  function scrollToTop() {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  return (
    <button type="button" className={styles.backToTop} onClick={scrollToTop}>
      <span aria-hidden="true" className={styles.arrow}>
        ↑
      </span>
      Back to top
    </button>
  );
}
```

`packages/ui/src/SiteFooter.tsx`:
```tsx
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
```

`packages/ui/src/SiteFooter.module.css`:
```css
/* The footer is dark in both colour schemes; re-map the tokens it uses so Badge and links adapt locally. */
.footer {
  --text: #eaf0fa;
  --text-muted: #9fb0ce;
  --border: rgb(234 240 250 / 0.2);
  --accent-text: #34d399;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin-top: var(--space-section);
  padding-top: 4.5rem;
  background: var(--ink);
  color: var(--text);
}

/* scalloped paper edge, like a torn receipt */
.footer::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 14px;
  background: radial-gradient(circle at 50% 0, var(--bg) 0 7px, transparent 7.5px) 0 0 / 20px 14px repeat-x;
}

/* emerald glow rising from the wordmark */
.footer::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 70%;
  z-index: -1;
  background: radial-gradient(60% 80% at 50% 100%, rgb(16 185 129 / 0.35), transparent 70%);
  pointer-events: none;
}

.top {
  display: grid;
  gap: 2.5rem;
  grid-template-columns: 1fr;
}

@media (min-width: 40rem) {
  .top {
    grid-template-columns: 1fr 1fr;
  }

  .pitch {
    grid-column: 1 / -1;
  }
}

@media (min-width: 64rem) {
  .top {
    grid-template-columns: 1.5fr repeat(3, 1fr);
  }

  .pitch {
    grid-column: auto;
  }
}

.pitchTitle {
  max-width: 18ch;
  font-family: var(--ff-display);
  font-size: clamp(1.7rem, 3.4vw, 2.3rem);
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.02em;
}

.pitchBody {
  max-width: 30rem;
  margin-top: 0.9rem;
  color: var(--text-muted);
}

.backToTop {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1.5rem;
  padding: 0.55rem 0.95rem;
  font: 600 0.95rem/1 var(--ff-sans);
  color: var(--text);
  background: transparent;
  border: 1.5px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.backToTop:hover {
  border-color: var(--amber);
  background: rgb(245 181 74 / 0.12);
}

.arrow {
  display: inline-block;
  transition: transform 0.2s ease;
}

.backToTop:hover .arrow {
  transform: translateY(-3px);
}

.heading {
  margin-bottom: 1rem;
  font: 500 0.78rem/1 var(--ff-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--amber);
}

.list {
  display: grid;
  gap: 0.7rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.list a {
  color: var(--text);
  text-decoration: none;
}

.list a:hover {
  text-decoration: underline 2px solid var(--amber);
  text-underline-offset: 5px;
}

.muted {
  color: var(--text-muted);
}

.legal {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem 2rem;
  margin-top: 3.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--border);
  font-size: 0.9rem;
  color: var(--text-muted);
}

.made {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.flag {
  width: 1.1rem;
  height: 0.75rem;
  border-radius: 2px;
  background: linear-gradient(#ff9933 0 33%, #ffffff 33% 66%, #138808 66%);
}

/* giant wordmark, cropped by the bottom edge */
.wordmark {
  margin-top: 1rem;
  margin-bottom: -0.17em;
  font-family: var(--ff-display);
  font-size: clamp(5rem, 25vw, 22rem);
  font-weight: 800;
  line-height: 0.8;
  letter-spacing: -0.045em;
  text-align: center;
  white-space: nowrap;
  background: linear-gradient(95deg, #10b981 5%, #f5b54a 95%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  opacity: 0.92;
  user-select: none;
}
```

- [ ] **Step 6: Export from the package index**

Replace `packages/ui/src/index.ts` with:
```ts
export { BRAND } from './brand';
export { Badge, type BadgeProps } from './Badge';
export { BackToTop } from './BackToTop';
export { Button } from './Button';
export { formatIsoDate } from './format';
export { Logo, type LogoProps } from './Logo';
export { SiteFooter, type FooterCountry, type FooterTool, type SiteFooterProps } from './SiteFooter';
export { SiteHeader, type NavLink, type SiteHeaderProps } from './SiteHeader';
```

- [ ] **Step 7: Run tests and typecheck**

Run: `pnpm --filter @solokit/ui test`
Expected: PASS (all Task 1 and Task 2 tests).
Run: `pnpm --filter @solokit/ui typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): add site header and signature footer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tool registry

**Files:**
- Create: `packages/registry/package.json`, `tsconfig.json`
- Create: `packages/registry/src/index.ts`, `tools.ts`
- Test: `packages/registry/src/tools.test.ts`

**Interfaces:**
- Produces (`@solokit/registry`):
  - `type ToolCategory = 'money' | 'clients' | 'marketing' | 'productivity' | 'documents'`
  - `type ToolStatus = 'available' | 'coming-soon'`
  - `interface ToolDefinition { slug: string; name: string; tagline: string; description: string; category: ToolCategory; status: ToolStatus; featured?: boolean }`
  - `TOOL_CATEGORY_LABELS: Record<ToolCategory, string>`
  - `getTools(): ToolDefinition[]`, `getAvailableTools(): ToolDefinition[]`, `getToolBySlug(slug: string): ToolDefinition | undefined`
  - `toolHref(slug: string): string` (returns `/tools/<slug>/`)

- [ ] **Step 1: Create the package files**

`packages/registry/package.json`:
```json
{
  "name": "@solokit/registry",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/registry/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/registry/src/tools.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  TOOL_CATEGORY_LABELS,
  getAvailableTools,
  getToolBySlug,
  getTools,
  toolHref,
} from './tools';

describe('tool registry', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = getTools().map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('puts the invoice generator first and features it', () => {
    const [first] = getTools();
    expect(first?.slug).toBe('invoice');
    expect(first?.featured).toBe(true);
  });

  it('gives every tool copy and a known category', () => {
    for (const tool of getTools()) {
      expect(tool.name).not.toBe('');
      expect(tool.tagline).not.toBe('');
      expect(tool.description).not.toBe('');
      expect(TOOL_CATEGORY_LABELS[tool.category]).toBeTruthy();
    }
  });

  it('looks tools up by slug', () => {
    expect(getToolBySlug('invoice')?.name).toBe('Invoice generator');
    expect(getToolBySlug('nope')).toBeUndefined();
  });

  it('lists only available tools', () => {
    expect(getAvailableTools().every((tool) => tool.status === 'available')).toBe(true);
  });

  it('builds trailing-slash hrefs', () => {
    expect(toolHref('invoice')).toBe('/tools/invoice/');
  });

  it('returns copies so callers cannot change the registry', () => {
    getTools().pop();
    expect(getTools().length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm install` then `pnpm --filter @solokit/registry test`
Expected: FAIL (cannot resolve `./tools`).

- [ ] **Step 4: Implement**

`packages/registry/src/tools.ts`:
```ts
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
```

`packages/registry/src/index.ts`:
```ts
export * from './tools';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/registry test`
Expected: PASS (7 tests).
Run: `pnpm --filter @solokit/registry typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(registry): add tool registry

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Local-first storage package

**Files:**
- Create: `packages/storage/package.json`, `tsconfig.json`
- Create: `packages/storage/src/types.ts`, `snapshot.ts`, `memory-store.ts`, `idb-store.ts`, `index.ts`
- Test: `packages/storage/src/snapshot.test.ts`, `contract.ts` (shared test suite), `stores.test.ts`

**Interfaces:**
- Produces (`@solokit/storage`):
  - `COLLECTIONS` = `['profile', 'clients', 'invoices', 'themes', 'settings']`, `type CollectionName`
  - `interface StoredRecord { id: string }`
  - `interface Snapshot { version: 1; exportedAt: string; collections: Record<CollectionName, StoredRecord[]> }`
  - `class StorageError extends Error`
  - `interface DataStore { get<T extends StoredRecord>(collection, id): Promise<T | undefined>; put<T extends StoredRecord>(collection, record: T): Promise<void>; list<T extends StoredRecord>(collection): Promise<T[]>; remove(collection, id): Promise<void>; exportAll(): Promise<Snapshot>; importAll(snapshot: unknown): Promise<void> }`
  - `parseSnapshot(input: unknown): Snapshot`
  - `createMemoryStore(): DataStore`
  - `createIndexedDbStore(options?: { name?: string; factory?: IDBFactory }): DataStore` (throws `StorageError` when IndexedDB is unavailable; opens lazily)

Behaviour: `put` rejects an empty `id`. Reads and writes copy values (mutating a returned object never changes the store). `importAll` validates the snapshot first, then replaces everything atomically; an invalid snapshot throws `StorageError` and leaves data untouched.

- [ ] **Step 1: Create the package files**

`packages/storage/package.json`:
```json
{
  "name": "@solokit/storage",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/storage/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the types**

`packages/storage/src/types.ts`:
```ts
export const COLLECTIONS = ['profile', 'clients', 'invoices', 'themes', 'settings'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export interface StoredRecord {
  id: string;
}

export interface Snapshot {
  version: 1;
  exportedAt: string;
  collections: Record<CollectionName, StoredRecord[]>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Where SoloKit keeps the user's data. Today: this device. Later: an optional synced adapter. */
export interface DataStore {
  get<T extends StoredRecord>(collection: CollectionName, id: string): Promise<T | undefined>;
  put<T extends StoredRecord>(collection: CollectionName, record: T): Promise<void>;
  list<T extends StoredRecord>(collection: CollectionName): Promise<T[]>;
  remove(collection: CollectionName, id: string): Promise<void>;
  exportAll(): Promise<Snapshot>;
  /** Replaces everything with the snapshot's contents. Invalid input throws StorageError and changes nothing. */
  importAll(snapshot: unknown): Promise<void>;
}
```

- [ ] **Step 3: Write the failing snapshot tests**

`packages/storage/src/snapshot.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseSnapshot } from './snapshot';
import { StorageError } from './types';

const valid = {
  version: 1,
  exportedAt: '2026-10-14T10:00:00.000Z',
  collections: {
    profile: [{ id: 'me', name: 'Asha' }],
    clients: [],
    invoices: [{ id: 'inv-1' }],
    themes: [],
    settings: [],
  },
};

describe('parseSnapshot', () => {
  it('accepts a valid snapshot', () => {
    expect(parseSnapshot(valid)).toEqual(valid);
  });

  it('treats a missing collection as empty', () => {
    const { clients: _clients, ...rest } = valid.collections;
    const parsed = parseSnapshot({ ...valid, collections: rest });
    expect(parsed.collections.clients).toEqual([]);
  });

  it('ignores unknown collections', () => {
    const parsed = parseSnapshot({ ...valid, collections: { ...valid.collections, secrets: [{ id: 'x' }] } });
    expect('secrets' in parsed.collections).toBe(false);
  });

  it('rejects anything that is not a version 1 snapshot', () => {
    for (const bad of [null, 'text', 42, [], {}, { ...valid, version: 2 }, { ...valid, exportedAt: 5 }]) {
      expect(() => parseSnapshot(bad)).toThrow(StorageError);
    }
  });

  it('rejects records without a string id', () => {
    const bad = { ...valid, collections: { ...valid.collections, clients: [{ name: 'No id' }] } };
    expect(() => parseSnapshot(bad)).toThrow(StorageError);
    const empty = { ...valid, collections: { ...valid.collections, clients: [{ id: '' }] } };
    expect(() => parseSnapshot(empty)).toThrow(StorageError);
  });

  it('rejects a collection that is not an array', () => {
    const bad = { ...valid, collections: { ...valid.collections, invoices: {} } };
    expect(() => parseSnapshot(bad)).toThrow(StorageError);
  });
});
```

- [ ] **Step 4: Run to verify failure, then implement the snapshot parser**

Run: `pnpm install` then `pnpm --filter @solokit/storage test`
Expected: FAIL (cannot resolve `./snapshot`).

`packages/storage/src/snapshot.ts`:
```ts
import { COLLECTIONS, StorageError, type CollectionName, type Snapshot, type StoredRecord } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function emptyCollections(): Record<CollectionName, StoredRecord[]> {
  return { profile: [], clients: [], invoices: [], themes: [], settings: [] };
}

/** Validates untrusted input (for example a backup file) and returns a clean Snapshot. */
export function parseSnapshot(input: unknown): Snapshot {
  if (!isObject(input) || input.version !== 1 || typeof input.exportedAt !== 'string' || !isObject(input.collections)) {
    throw new StorageError('This is not a SoloKit backup file');
  }
  const collections = emptyCollections();
  for (const name of COLLECTIONS) {
    const records = input.collections[name];
    if (records === undefined) continue;
    if (!Array.isArray(records)) {
      throw new StorageError(`Backup collection "${name}" must be a list`);
    }
    for (const record of records) {
      if (!isObject(record) || typeof record.id !== 'string' || record.id === '') {
        throw new StorageError(`Backup collection "${name}" has a record without an id`);
      }
      collections[name].push(record as unknown as StoredRecord);
    }
  }
  return { version: 1, exportedAt: input.exportedAt, collections };
}
```

Run: `pnpm --filter @solokit/storage test -- snapshot`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the shared store contract and the failing store tests**

`packages/storage/src/contract.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { StorageError, type DataStore } from './types';

interface Doc {
  id: string;
  name: string;
  nested?: { count: number };
}

/** The behaviour every DataStore adapter must have. */
export function describeStoreContract(label: string, makeStore: () => DataStore) {
  describe(`${label} (DataStore contract)`, () => {
    it('returns undefined for a missing record', async () => {
      const store = makeStore();
      expect(await store.get('clients', 'nope')).toBeUndefined();
    });

    it('stores and reads a record', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Acme', nested: { count: 2 } });
      expect(await store.get<Doc>('clients', 'c1')).toEqual({ id: 'c1', name: 'Acme', nested: { count: 2 } });
    });

    it('overwrites a record with the same id', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Old' });
      await store.put<Doc>('clients', { id: 'c1', name: 'New' });
      expect(await store.list<Doc>('clients')).toEqual([{ id: 'c1', name: 'New' }]);
    });

    it('never shares objects with the caller', async () => {
      const store = makeStore();
      const original: Doc = { id: 'c1', name: 'Acme', nested: { count: 1 } };
      await store.put('clients', original);
      original.nested!.count = 99;
      const read = await store.get<Doc>('clients', 'c1');
      expect(read?.nested?.count).toBe(1);
      read!.nested!.count = 50;
      expect((await store.get<Doc>('clients', 'c1'))?.nested?.count).toBe(1);
    });

    it('lists every record in a collection', async () => {
      const store = makeStore();
      await store.put<Doc>('invoices', { id: 'a', name: 'A' });
      await store.put<Doc>('invoices', { id: 'b', name: 'B' });
      const ids = (await store.list<Doc>('invoices')).map((doc) => doc.id).sort();
      expect(ids).toEqual(['a', 'b']);
    });

    it('keeps collections separate', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'x', name: 'Client' });
      expect(await store.get('invoices', 'x')).toBeUndefined();
    });

    it('removes a record and tolerates removing a missing one', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Acme' });
      await store.remove('clients', 'c1');
      await store.remove('clients', 'c1');
      expect(await store.list('clients')).toEqual([]);
    });

    it('rejects a record without an id', async () => {
      const store = makeStore();
      await expect(store.put('clients', { id: '', name: 'x' } as Doc)).rejects.toBeInstanceOf(StorageError);
    });

    it('exports a snapshot containing every collection', async () => {
      const store = makeStore();
      await store.put<Doc>('profile', { id: 'me', name: 'Asha' });
      const snapshot = await store.exportAll();
      expect(snapshot.version).toBe(1);
      expect(typeof snapshot.exportedAt).toBe('string');
      expect(Object.keys(snapshot.collections).sort()).toEqual(['clients', 'invoices', 'profile', 'settings', 'themes']);
      expect(snapshot.collections.profile).toEqual([{ id: 'me', name: 'Asha' }]);
    });

    it('imports a snapshot, replacing everything', async () => {
      const source = makeStore();
      await source.put<Doc>('clients', { id: 'c1', name: 'From backup' });
      const backup = JSON.parse(JSON.stringify(await source.exportAll())) as unknown;

      const target = makeStore();
      await target.put<Doc>('clients', { id: 'old', name: 'Will be removed' });
      await target.put<Doc>('invoices', { id: 'i-old', name: 'Also removed' });
      await target.importAll(backup);

      expect(await target.list<Doc>('clients')).toEqual([{ id: 'c1', name: 'From backup' }]);
      expect(await target.list('invoices')).toEqual([]);
    });

    it('rejects an invalid snapshot and leaves existing data alone', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'keep', name: 'Keep me' });
      await expect(store.importAll({ version: 2 })).rejects.toBeInstanceOf(StorageError);
      await expect(store.importAll('nonsense')).rejects.toBeInstanceOf(StorageError);
      expect(await store.list<Doc>('clients')).toEqual([{ id: 'keep', name: 'Keep me' }]);
    });
  });
}
```

`packages/storage/src/stores.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { describeStoreContract } from './contract';
import { createIndexedDbStore } from './idb-store';
import { createMemoryStore } from './memory-store';
import { StorageError } from './types';

describeStoreContract('memory store', () => createMemoryStore());

let counter = 0;
const freshName = () => `solokit-test-${++counter}`;
describeStoreContract('IndexedDB store', () => createIndexedDbStore({ name: freshName() }));

describe('IndexedDB store', () => {
  it('persists across store instances that share a database name', async () => {
    const name = freshName();
    await createIndexedDbStore({ name }).put('settings', { id: 'theme', value: 'dark' } as never);
    const reopened = await createIndexedDbStore({ name }).get<{ id: string; value: string }>('settings', 'theme');
    expect(reopened).toEqual({ id: 'theme', value: 'dark' });
  });

  it('throws a StorageError when IndexedDB is unavailable', () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      expect(() => createIndexedDbStore()).toThrow(StorageError);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
```

Run: `pnpm --filter @solokit/storage test -- stores`
Expected: FAIL (cannot resolve `./idb-store` and `./memory-store`).

- [ ] **Step 6: Implement the memory store**

`packages/storage/src/memory-store.ts`:
```ts
import { parseSnapshot, emptyCollections } from './snapshot';
import { COLLECTIONS, StorageError, type CollectionName, type DataStore, type Snapshot, type StoredRecord } from './types';

function assertRecord(record: StoredRecord): void {
  if (typeof record.id !== 'string' || record.id === '') {
    throw new StorageError('A record needs a non-empty id');
  }
}

/** In-memory adapter: used by tests and as the fallback when the browser blocks IndexedDB. */
export function createMemoryStore(): DataStore {
  const tables = new Map<CollectionName, Map<string, StoredRecord>>(COLLECTIONS.map((name) => [name, new Map()]));

  function table(collection: CollectionName): Map<string, StoredRecord> {
    const found = tables.get(collection);
    if (!found) throw new StorageError(`Unknown collection "${collection}"`);
    return found;
  }

  return {
    async get<T extends StoredRecord>(collection: CollectionName, id: string) {
      const record = table(collection).get(id);
      return record === undefined ? undefined : (structuredClone(record) as T);
    },

    async put<T extends StoredRecord>(collection: CollectionName, record: T) {
      assertRecord(record);
      table(collection).set(record.id, structuredClone(record));
    },

    async list<T extends StoredRecord>(collection: CollectionName) {
      return [...table(collection).values()].map((record) => structuredClone(record) as T);
    },

    async remove(collection, id) {
      table(collection).delete(id);
    },

    async exportAll(): Promise<Snapshot> {
      const collections = emptyCollections();
      for (const name of COLLECTIONS) {
        collections[name] = [...table(name).values()].map((record) => structuredClone(record));
      }
      return { version: 1, exportedAt: new Date().toISOString(), collections };
    },

    async importAll(input) {
      const snapshot = parseSnapshot(input);
      for (const name of COLLECTIONS) {
        const next = table(name);
        next.clear();
        for (const record of snapshot.collections[name]) next.set(record.id, structuredClone(record));
      }
    },
  };
}
```

- [ ] **Step 7: Implement the IndexedDB store**

`packages/storage/src/idb-store.ts`:
```ts
import { emptyCollections, parseSnapshot } from './snapshot';
import { COLLECTIONS, StorageError, type CollectionName, type DataStore, type Snapshot, type StoredRecord } from './types';

const DEFAULT_NAME = 'solokit';
const VERSION = 1;

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError(request.error?.message ?? 'IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new StorageError(tx.error?.message ?? 'IndexedDB transaction failed'));
    tx.onabort = () => reject(new StorageError(tx.error?.message ?? 'IndexedDB transaction aborted'));
  });
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, VERSION);
    request.onupgradeneeded = () => {
      for (const collection of COLLECTIONS) {
        if (!request.result.objectStoreNames.contains(collection)) {
          request.result.createObjectStore(collection, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError(request.error?.message ?? 'Could not open IndexedDB'));
    request.onblocked = () => reject(new StorageError('IndexedDB is blocked by another tab'));
  });
}

export interface IndexedDbStoreOptions {
  name?: string;
  factory?: IDBFactory;
}

/** Browser adapter: keeps everything on the user's device. The database opens on first use. */
export function createIndexedDbStore(options: IndexedDbStoreOptions = {}): DataStore {
  const factory = options.factory ?? globalThis.indexedDB;
  if (!factory) throw new StorageError('IndexedDB is not available in this browser');
  const name = options.name ?? DEFAULT_NAME;

  let opening: Promise<IDBDatabase> | undefined;
  const database = () => (opening ??= openDatabase(factory, name));

  return {
    async get<T extends StoredRecord>(collection: CollectionName, id: string) {
      const db = await database();
      const found = await toPromise(db.transaction(collection).objectStore(collection).get(id));
      return found as T | undefined;
    },

    async put<T extends StoredRecord>(collection: CollectionName, record: T) {
      if (typeof record.id !== 'string' || record.id === '') {
        throw new StorageError('A record needs a non-empty id');
      }
      const db = await database();
      const tx = db.transaction(collection, 'readwrite');
      tx.objectStore(collection).put(record);
      await transactionDone(tx);
    },

    async list<T extends StoredRecord>(collection: CollectionName) {
      const db = await database();
      return (await toPromise(db.transaction(collection).objectStore(collection).getAll())) as T[];
    },

    async remove(collection, id) {
      const db = await database();
      const tx = db.transaction(collection, 'readwrite');
      tx.objectStore(collection).delete(id);
      await transactionDone(tx);
    },

    async exportAll(): Promise<Snapshot> {
      const db = await database();
      const tx = db.transaction([...COLLECTIONS]);
      const collections = emptyCollections();
      await Promise.all(
        COLLECTIONS.map(async (collection) => {
          collections[collection] = (await toPromise(tx.objectStore(collection).getAll())) as StoredRecord[];
        }),
      );
      return { version: 1, exportedAt: new Date().toISOString(), collections };
    },

    async importAll(input) {
      const snapshot = parseSnapshot(input);
      const db = await database();
      const tx = db.transaction([...COLLECTIONS], 'readwrite');
      for (const collection of COLLECTIONS) {
        const objectStore = tx.objectStore(collection);
        objectStore.clear();
        for (const record of snapshot.collections[collection]) objectStore.put(record);
      }
      await transactionDone(tx);
    },
  };
}
```

`packages/storage/src/index.ts`:
```ts
export * from './types';
export { parseSnapshot } from './snapshot';
export { createMemoryStore } from './memory-store';
export { createIndexedDbStore, type IndexedDbStoreOptions } from './idb-store';
```

- [ ] **Step 8: Run tests and typecheck**

Run: `pnpm --filter @solokit/storage test`
Expected: PASS (snapshot 6, memory contract 11, IndexedDB contract 11, plus 2 IndexedDB-specific).
Run: `pnpm --filter @solokit/storage typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(storage): add DataStore interface with memory and IndexedDB adapters

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Web app scaffold and site chrome

**Files:**
- Create: `apps/web/package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`
- Create: `apps/web/src/site.ts`
- Test: `apps/web/src/site.test.ts`
- Modify: `.gitignore`, root `package.json`

**Interfaces:**
- Consumes: `SiteHeaderProps`, `SiteFooterProps` from `@solokit/ui`; `getTools`, `toolHref` from `@solokit/registry`; `getCountries`, `IN_RULES_AS_OF` from `@solokit/tax-engines`.
- Produces (`apps/web/src/site.ts`): `HEADER_PROPS: SiteHeaderProps`, `getFooterProps(): SiteFooterProps`.

- [ ] **Step 1: Create the app files**

`apps/web/package.json`:
```json
{
  "name": "@solokit/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "icons": "node scripts/generate-icons.mjs"
  },
  "dependencies": {
    "@solokit/core": "workspace:*",
    "@solokit/registry": "workspace:*",
    "@solokit/storage": "workspace:*",
    "@solokit/tax-engines": "workspace:*",
    "@solokit/ui": "workspace:*",
    "next": "^16.4.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@resvg/resvg-js": "^2.6.2",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```
(`@types/node` is declared up front on purpose: if Next has to install it during `next build`, pnpm creates a second copy of `next` without React linked and the prerender fails with "Cannot read properties of null (reading 'useContext')".)

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: [
    '@solokit/core',
    '@solokit/registry',
    '@solokit/storage',
    '@solokit/tax-engines',
    '@solokit/ui',
  ],
};

export default config;
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out", ".next"]
}
```

`apps/web/vitest.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`apps/web/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

- [ ] **Step 2: Write the failing test for the site config**

`apps/web/src/site.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { IN_RULES_AS_OF } from '@solokit/tax-engines';
import { HEADER_PROPS, getFooterProps } from './site';

describe('site config', () => {
  it('points the header call to action at the invoice tool', () => {
    expect(HEADER_PROPS.cta).toEqual({ label: 'Create an invoice', href: '/tools/invoice/' });
    expect(HEADER_PROPS.links.map((link) => link.label)).toEqual(['Tools', 'Privacy']);
  });

  it('builds footer tool links from the registry', () => {
    const { tools } = getFooterProps();
    const invoice = tools.find((tool) => tool.href === '/tools/invoice/');
    expect(invoice?.label).toBe('Invoice generator');
    expect(tools.length).toBeGreaterThan(1);
  });

  it('lists India as available and every other country as coming soon', () => {
    const { countries } = getFooterProps();
    expect(countries.find((country) => country.code === 'IN')?.status).toBe('available');
    expect(countries.filter((country) => country.code !== 'IN').every((country) => country.status === 'coming-soon')).toBe(true);
  });

  it('uses the India rules date for the tax disclaimer', () => {
    expect(getFooterProps().rulesAsOf).toBe(IN_RULES_AS_OF);
  });

  it('offers project links to pages that exist', () => {
    expect(getFooterProps().projectLinks).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Privacy', href: '/privacy/' },
    ]);
  });
});
```

- [ ] **Step 3: Install and run to verify failure**

Run: `pnpm install`
Then: `pnpm --filter @solokit/web test`
Expected: FAIL (cannot resolve `./site`).

- [ ] **Step 4: Implement the site config**

`apps/web/src/site.ts`:
```ts
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
```

- [ ] **Step 5: Create the layout and a placeholder home page**

`apps/web/app/layout.tsx`:
```tsx
import '@solokit/ui/tokens.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { BRAND, SiteFooter, SiteHeader } from '@solokit/ui';
import { HEADER_PROPS, getFooterProps } from '../src/site';

const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], variable: '--font-display' });
const sans = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: free tools for freelancers and solopreneurs`, template: `%s | ${BRAND.name}` },
  description:
    'Free invoice, quote and contract tools that run in your browser. India GST ready. No signup, works offline, and your data stays on your device.',
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1428' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader {...HEADER_PROPS} />
        {children}
        <SiteFooter {...getFooterProps()} />
      </body>
    </html>
  );
}
```

`apps/web/app/page.tsx` (placeholder, replaced in Task 8):
```tsx
export default function Home() {
  return (
    <main id="main" className="container">
      <h1>SoloKit</h1>
    </main>
  );
}
```

- [ ] **Step 6: Update `.gitignore` and the root scripts**

Append to `.gitignore`:
```
next-env.d.ts
*.tsbuildinfo
```

Replace the `scripts` block in the root `package.json` with:
```json
  "scripts": {
    "dev": "pnpm --filter @solokit/web dev",
    "build": "pnpm --filter @solokit/web build",
    "preview": "pnpm dlx serve apps/web/out",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
```

- [ ] **Step 7: Run tests, typecheck and a full static build**

Run: `pnpm --filter @solokit/web test`
Expected: PASS (5 tests).
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.
Run: `pnpm build`
Expected: "Compiled successfully", route table lists `/` and `/_not-found` as static.
Run: `ls apps/web/out/index.html apps/web/out/_next/static/media | head -5`
Expected: `index.html` exists and `.woff2` font files are listed (fonts are self-hosted).
Run: `grep -c "Skip to content" apps/web/out/index.html`
Expected: `1`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Next.js static app with site chrome

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Store provider

**Files:**
- Create: `apps/web/src/store/StoreProvider.tsx`
- Test: `apps/web/src/store/StoreProvider.test.tsx`

**Interfaces:**
- Consumes: `createIndexedDbStore`, `createMemoryStore`, `type DataStore` from `@solokit/storage`.
- Produces:
  - `StoreProvider` props: `{ children: ReactNode; factory?: () => DataStore }` (client component)
  - `useStore(): { store: DataStore | null; persistent: boolean; ready: boolean }`
  - Behaviour: after mount it creates the store with `factory` (default `createIndexedDbStore`) and probes it once with `store.list('settings')`. If creating or probing fails it falls back to `createMemoryStore()` with `persistent: false`, so the app still works when the browser blocks IndexedDB.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/store/StoreProvider.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { StoreProvider, useStore } from './StoreProvider';

function Probe() {
  const { store, persistent, ready } = useStore();
  return (
    <p>
      {ready ? 'ready' : 'loading'} / {store ? 'store' : 'no store'} / {persistent ? 'persistent' : 'temporary'}
    </p>
  );
}

describe('StoreProvider', () => {
  it('is not ready before the store has been probed', () => {
    render(
      <StoreProvider factory={createMemoryStore}>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByText('loading / no store / temporary')).toBeInTheDocument();
  });

  it('provides a persistent store once it works', async () => {
    render(
      <StoreProvider factory={createMemoryStore}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / persistent')).toBeInTheDocument();
  });

  it('falls back to a temporary store when creating the store throws', async () => {
    const broken = () => {
      throw new Error('IndexedDB blocked');
    };
    render(
      <StoreProvider factory={broken}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
  });

  it('falls back to a temporary store when the first read fails', async () => {
    const failing = (): DataStore => ({
      ...createMemoryStore(),
      list: () => Promise.reject(new Error('quota')),
    });
    render(
      <StoreProvider factory={failing}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
  });
});
```
Note: the two factories (`broken`, `failing`) are defined outside `render` so their identity is stable.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- StoreProvider`
Expected: FAIL (cannot resolve `./StoreProvider`).

- [ ] **Step 3: Implement**

`apps/web/src/store/StoreProvider.tsx`:
```tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createIndexedDbStore, createMemoryStore, type DataStore } from '@solokit/storage';

export interface StoreState {
  store: DataStore | null;
  /** False when the browser blocked IndexedDB and data will be lost on reload. */
  persistent: boolean;
  ready: boolean;
}

const INITIAL: StoreState = { store: null, persistent: false, ready: false };
const StoreContext = createContext<StoreState>(INITIAL);

export interface StoreProviderProps {
  children: ReactNode;
  factory?: () => DataStore;
}

export function StoreProvider({ children, factory = createIndexedDbStore }: StoreProviderProps) {
  const [state, setState] = useState<StoreState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: StoreState;
      try {
        const store = factory();
        await store.list('settings');
        next = { store, persistent: true, ready: true };
      } catch {
        next = { store: createMemoryStore(), persistent: false, ready: true };
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [factory]);

  return <StoreContext.Provider value={state}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  return useContext(StoreContext);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- StoreProvider`
Expected: PASS (4 tests).
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add store provider with in-memory fallback

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Live GST receipt (home page hero demo)

**Files:**
- Create: `apps/web/src/components/computeDemo.ts`, `ReceiptDemo.tsx`, `ReceiptDemo.module.css`
- Test: `apps/web/src/components/computeDemo.test.ts`, `ReceiptDemo.test.tsx`

**Interfaces:**
- Consumes: `amountInWords`, `formatMoney`, `parseMoney` from `@solokit/core`; `calculateGst` from `@solokit/tax-engines`.
- Produces:
  - `DemoRow = { label: string; amount: string }`
  - `DemoResult = { taxable: string; taxRows: DemoRow[]; total: string; words: string }`
  - `computeDemo(input: string, sameState: boolean): DemoResult | null` (null when the input is not a positive amount up to ₹100 crore). The sample seller is registered in Maharashtra (state code 27); "same state" means a buyer in Maharashtra, otherwise Karnataka (29); the rate is 18%; round-off to the rupee is on.
  - `ReceiptDemo` (client component, no props)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/components/computeDemo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatMoney } from '@solokit/core';
import { computeDemo } from './computeDemo';

describe('computeDemo', () => {
  it('splits 18% GST into CGST and SGST within the same state', () => {
    expect(computeDemo('1,00,000', true)).toEqual({
      taxable: '₹1,00,000.00',
      taxRows: [
        { label: 'CGST 9%', amount: '₹9,000.00' },
        { label: 'SGST 9%', amount: '₹9,000.00' },
      ],
      total: '₹1,18,000.00',
      words: 'One Lakh Eighteen Thousand Rupees Only',
    });
  });

  it('charges IGST outside the state', () => {
    const result = computeDemo('1,00,000', false);
    expect(result?.taxRows).toEqual([{ label: 'IGST 18%', amount: '₹18,000.00' }]);
    expect(result?.total).toBe('₹1,18,000.00');
  });

  it('shows the round-off line when the total is rounded to the rupee', () => {
    const result = computeDemo('333.33', true);
    expect(result?.taxRows).toEqual([
      { label: 'CGST 9%', amount: formatMoney(3000) },
      { label: 'SGST 9%', amount: formatMoney(3000) },
      { label: 'Round off', amount: formatMoney(-33) },
    ]);
    expect(result?.total).toBe(formatMoney(39300));
  });

  it('returns null for input that is not a usable amount', () => {
    for (const input of ['', 'abc', '0', '-5', '1.234', '1000000000.01']) {
      expect(computeDemo(input, true)).toBeNull();
    }
  });
});
```

`apps/web/src/components/ReceiptDemo.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReceiptDemo } from './ReceiptDemo';

describe('ReceiptDemo', () => {
  it('starts with a worked example', () => {
    render(<ReceiptDemo />);
    expect(screen.getByLabelText('Amount before GST')).toHaveValue('1,00,000');
    expect(screen.getByText('CGST 9%')).toBeInTheDocument();
    expect(screen.getByText('SGST 9%')).toBeInTheDocument();
    expect(screen.getByText('₹1,18,000.00')).toBeInTheDocument();
    expect(screen.getByText('One Lakh Eighteen Thousand Rupees Only')).toBeInTheDocument();
  });

  it('recalculates as you type', async () => {
    render(<ReceiptDemo />);
    const input = screen.getByLabelText('Amount before GST');
    await userEvent.clear(input);
    await userEvent.type(input, '50000');
    expect(screen.getByText('₹59,000.00')).toBeInTheDocument();
    expect(screen.getByText('Fifty-Nine Thousand Rupees Only')).toBeInTheDocument();
  });

  it('switches to IGST for a buyer in another state', async () => {
    render(<ReceiptDemo />);
    await userEvent.click(screen.getByRole('radio', { name: 'Buyer in another state' }));
    expect(screen.getByText('IGST 18%')).toBeInTheDocument();
    expect(screen.queryByText('CGST 9%')).not.toBeInTheDocument();
  });

  it('asks for a valid amount instead of showing nonsense', async () => {
    render(<ReceiptDemo />);
    const input = screen.getByLabelText('Amount before GST');
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    expect(screen.getByText('Enter an amount like 1,00,000')).toBeInTheDocument();
    expect(screen.queryByText(/Rupees Only/)).not.toBeInTheDocument();
  });

  it('is labelled as an example, not a real invoice', () => {
    render(<ReceiptDemo />);
    expect(screen.getByText('Example')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- components`
Expected: FAIL (cannot resolve `./computeDemo` and `./ReceiptDemo`).

- [ ] **Step 3: Implement the calculation**

`apps/web/src/components/computeDemo.ts`:
```ts
import { amountInWords, formatMoney, parseMoney } from '@solokit/core';
import { calculateGst } from '@solokit/tax-engines';

export interface DemoRow {
  label: string;
  amount: string;
}

export interface DemoResult {
  taxable: string;
  taxRows: DemoRow[];
  total: string;
  words: string;
}

const SELLER_STATE = '27'; // Maharashtra
const OTHER_STATE = '29'; // Karnataka
const MAX_AMOUNT = 100 * 10_000_000 * 100; // Rs 100 crore, in paise

/** A sample 18% GST invoice line for the home page. Uses the real calculation engine. */
export function computeDemo(input: string, sameState: boolean): DemoResult | null {
  const taxable = parseMoney(input);
  if (taxable === null || taxable <= 0 || taxable > MAX_AMOUNT) return null;

  const result = calculateGst({
    sellerStatus: 'regular',
    sellerStateCode: SELLER_STATE,
    placeOfSupplyStateCode: sameState ? SELLER_STATE : OTHER_STATE,
    lines: [{ quantity: 1, unitRate: taxable, gstRate: 18 }],
    roundOff: true,
  });

  const { cgst, sgst, igst, roundOff, grandTotal } = result.totals;
  const taxRows: DemoRow[] = sameState
    ? [
        { label: 'CGST 9%', amount: formatMoney(cgst) },
        { label: 'SGST 9%', amount: formatMoney(sgst) },
      ]
    : [{ label: 'IGST 18%', amount: formatMoney(igst) }];
  if (roundOff !== 0) taxRows.push({ label: 'Round off', amount: formatMoney(roundOff) });

  return {
    taxable: formatMoney(taxable),
    taxRows,
    total: formatMoney(grandTotal),
    words: amountInWords(grandTotal),
  };
}
```

Run: `pnpm --filter @solokit/web test -- computeDemo`
Expected: PASS (4 tests).

- [ ] **Step 4: Implement the component**

`apps/web/src/components/ReceiptDemo.tsx`:
```tsx
'use client';

import { useId, useState } from 'react';
import { computeDemo } from './computeDemo';
import styles from './ReceiptDemo.module.css';

export function ReceiptDemo() {
  const [amount, setAmount] = useState('1,00,000');
  const [sameState, setSameState] = useState(true);
  const inputId = useId();
  const result = computeDemo(amount, sameState);

  return (
    <section className={styles.receipt} aria-label="Live GST example">
      <header className={styles.head}>
        <span className={styles.stamp}>Example</span>
        <span className={`num ${styles.title}`}>Tax invoice</span>
      </header>

      <label className={styles.label} htmlFor={inputId}>
        Amount before GST
      </label>
      <div className={styles.field}>
        <span className={`num ${styles.symbol}`} aria-hidden="true">
          ₹
        </span>
        <input
          id={inputId}
          className={`num ${styles.input}`}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <fieldset className={styles.supply}>
        <legend className="sr-only">Where is the buyer?</legend>
        <label className={styles.choice}>
          <input type="radio" name="supply" checked={sameState} onChange={() => setSameState(true)} />
          <span>Buyer in Maharashtra</span>
        </label>
        <label className={styles.choice}>
          <input type="radio" name="supply" checked={!sameState} onChange={() => setSameState(false)} />
          <span>Buyer in another state</span>
        </label>
      </fieldset>

      <div aria-live="polite">
        {result ? (
          <>
            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt>Taxable value</dt>
                <dd className="num">{result.taxable}</dd>
              </div>
              {result.taxRows.map((row) => (
                <div className={styles.row} key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className="num">{row.amount}</dd>
                </div>
              ))}
              <div className={`${styles.row} ${styles.total}`}>
                <dt>Total</dt>
                <dd className="num">{result.total}</dd>
              </div>
            </dl>
            <p className={styles.words}>{result.words}</p>
          </>
        ) : (
          <p className={styles.hint}>Enter an amount like 1,00,000</p>
        )}
      </div>
    </section>
  );
}
```

`apps/web/src/components/ReceiptDemo.module.css`:
```css
.receipt {
  position: relative;
  width: 100%;
  max-width: 30rem;
  margin-inline: auto;
  padding: 1.5rem 1.5rem 2.25rem;
  background-color: var(--surface);
  background-image: var(--grain);
  border: 1.5px solid var(--edge);
  border-bottom: none;
  border-radius: var(--radius-m) var(--radius-m) 0 0;
  box-shadow: var(--shadow-card);
  animation: print 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

/* torn paper edge hanging below the card */
.receipt::after {
  content: '';
  position: absolute;
  inset: 100% -1.5px auto -1.5px;
  height: 10px;
  background-color: var(--surface);
  background-image: var(--grain);
  -webkit-mask: conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) 50% / 16px 100%;
  mask: conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) 50% / 16px 100%;
}

@keyframes print {
  from {
    clip-path: inset(0 0 100% 0);
    transform: translateY(-6px);
  }
  to {
    clip-path: inset(0 0 -20px 0);
    transform: none;
  }
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  padding-bottom: 0.9rem;
  border-bottom: 1.5px dashed var(--border);
}

.stamp {
  padding: 0.2rem 0.55rem;
  font: 600 0.72rem/1.2 var(--ff-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-text);
  border: 1.5px solid currentColor;
  border-radius: var(--radius-s);
  transform: rotate(-3deg);
}

.title {
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.field {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding-bottom: 0.3rem;
  border-bottom: 2px solid var(--edge);
}

.symbol {
  font-size: 1.6rem;
  color: var(--text-muted);
}

.input {
  width: 100%;
  min-width: 0;
  font-size: 2rem;
  font-weight: 600;
  color: var(--text);
  background: transparent;
  border: 0;
  outline: none;
}

.field:focus-within {
  border-bottom-color: var(--accent);
}

.supply {
  display: grid;
  gap: 0.4rem;
  margin: 1.1rem 0 1.25rem;
  padding: 0;
  border: 0;
}

.choice {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
}

.choice input {
  accent-color: var(--emerald);
}

.rows {
  margin: 0;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px dotted var(--border);
}

.row dt {
  color: var(--text-muted);
}

.row dd {
  margin: 0;
}

.total {
  margin-top: 0.4rem;
  border-bottom: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.total dt {
  color: var(--text);
}

.total dd {
  padding-inline: 0.35rem;
  background: linear-gradient(transparent 55%, color-mix(in srgb, var(--amber) 55%, transparent) 55% 92%, transparent 92%);
}

.words {
  margin-top: 0.9rem;
  font-style: italic;
  color: var(--text-muted);
}

.hint {
  padding: 1rem 0;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- components`
Expected: PASS (computeDemo 4, ReceiptDemo 5).
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add live GST receipt demo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Home page

**Files:**
- Create: `apps/web/src/components/Hero.tsx`, `Hero.module.css`
- Create: `apps/web/src/components/TrustStrip.tsx`, `TrustStrip.module.css`
- Create: `apps/web/src/components/ToolGrid.tsx`, `ToolGrid.module.css`
- Create: `apps/web/src/components/LocalSection.tsx`, `LocalSection.module.css`
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/src/components/home.test.tsx`

**Interfaces:**
- Consumes: `Button`, `Badge` from `@solokit/ui`; `getTools`, `toolHref`, `TOOL_CATEGORY_LABELS` from `@solokit/registry`; `ReceiptDemo` from Task 7.
- Produces: default export `Home` (server component) composed of `Hero`, `TrustStrip`, `ToolGrid`, `LocalSection`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/home.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getTools } from '@solokit/registry';
import Home from '../../app/page';

describe('Home page', () => {
  it('leads with the promise and the main call to action', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paperwork for one-person businesses.');
    expect(screen.getByRole('link', { name: 'Create an invoice' })).toHaveAttribute('href', '/tools/invoice/');
    expect(screen.getByRole('link', { name: 'See all tools' })).toHaveAttribute('href', '/#tools');
  });

  it('shows the live GST example', () => {
    render(<Home />);
    expect(screen.getByRole('region', { name: 'Live GST example' })).toBeInTheDocument();
  });

  it('states the trust points', () => {
    render(<Home />);
    const strip = screen.getByRole('list', { name: 'Why people trust it' });
    for (const text of ['Free', 'No signup', 'Works offline', 'Data stays on your device']) {
      expect(within(strip).getByText(text)).toBeInTheDocument();
    }
  });

  it('lists every registry tool, linking only the ones that are available', () => {
    render(<Home />);
    const section = screen.getByRole('region', { name: 'Tools' });
    for (const tool of getTools()) {
      expect(within(section).getByText(tool.name)).toBeInTheDocument();
      const link = within(section).queryByRole('link', { name: new RegExp(tool.name) });
      if (tool.status === 'available') expect(link).toBeInTheDocument();
      else expect(link).not.toBeInTheDocument();
    }
  });

  it('explains why local-first matters', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'Nothing is uploaded' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Works without internet' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Back up when you like' })).toBeInTheDocument();
  });

  it('has a single main landmark the skip link can target', () => {
    render(<Home />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- home`
Expected: FAIL (the placeholder page has no headline, links or sections).

- [ ] **Step 3: Implement the hero and trust strip**

`apps/web/src/components/Hero.tsx`:
```tsx
import { Button } from '@solokit/ui';
import { toolHref } from '@solokit/registry';
import { ReceiptDemo } from './ReceiptDemo';
import { TrustStrip } from './TrustStrip';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={`container ${styles.hero}`}>
      <div className={styles.grid}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            Free tools, built in India
          </p>
          <h1 className={styles.title}>
            Paperwork for <em>one-person</em> businesses.
          </h1>
          <p className={styles.lede}>
            Invoices, quotes and agreements that run in your browser. Free, no login, and nothing you type leaves your
            device.
          </p>
          <div className={styles.actions}>
            <Button href={toolHref('invoice')}>Create an invoice</Button>
            <Button href="/#tools" variant="secondary">
              See all tools
            </Button>
          </div>
          <TrustStrip />
        </div>
        <ReceiptDemo />
      </div>
    </section>
  );
}
```

`apps/web/src/components/Hero.module.css`:
```css
.hero {
  padding-block: clamp(2.5rem, 6vw, 5rem) 0;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: clamp(2.5rem, 6vw, 4.5rem);
}

@media (min-width: 62rem) {
  .grid {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  }
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
  font: 500 0.8rem/1 var(--ff-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-text);
}

.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
}

.title {
  font-size: clamp(2.7rem, 7.2vw, 5.2rem);
  font-weight: 800;
  line-height: 0.98;
}

.title em {
  font-style: normal;
  padding-inline: 0.06em;
  background: linear-gradient(transparent 60%, color-mix(in srgb, var(--amber) 70%, transparent) 60% 92%, transparent 92%);
}

.lede {
  max-width: 34rem;
  margin-top: 1.5rem;
  font-size: 1.2rem;
  color: var(--text-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 2rem;
}
```

`apps/web/src/components/TrustStrip.tsx`:
```tsx
import styles from './TrustStrip.module.css';

const POINTS = ['Free', 'No signup', 'Works offline', 'Data stays on your device'] as const;

export function TrustStrip() {
  return (
    <ul className={styles.strip} aria-label="Why people trust it">
      {POINTS.map((point) => (
        <li key={point} className={styles.stamp}>
          {point}
        </li>
      ))}
    </ul>
  );
}
```

`apps/web/src/components/TrustStrip.module.css`:
```css
.strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 0.75rem;
  margin: 2.25rem 0 0;
  padding: 0;
  list-style: none;
}

.stamp {
  padding: 0.4rem 0.7rem;
  font: 500 0.78rem/1.2 var(--ff-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
  border: 1.5px solid var(--edge);
  border-radius: var(--radius-s);
}

.stamp:nth-child(odd) {
  transform: rotate(-1.2deg);
}

.stamp:nth-child(even) {
  transform: rotate(0.9deg);
}
```

- [ ] **Step 4: Implement the tool grid and the local-first section**

`apps/web/src/components/ToolGrid.tsx`:
```tsx
import { TOOL_CATEGORY_LABELS, getTools, toolHref, type ToolDefinition } from '@solokit/registry';
import { Badge } from '@solokit/ui';
import styles from './ToolGrid.module.css';

function CardBody({ tool }: { tool: ToolDefinition }) {
  return (
    <>
      <div className={styles.meta}>
        <span className={styles.category}>{TOOL_CATEGORY_LABELS[tool.category]}</span>
        {tool.status === 'available' ? <Badge tone="success">Ready</Badge> : <Badge tone="soon">Coming soon</Badge>}
      </div>
      <h3 className={styles.name}>{tool.name}</h3>
      <p className={styles.tagline}>{tool.tagline}</p>
    </>
  );
}

export function ToolGrid() {
  return (
    <section id="tools" aria-labelledby="tools-heading" className={`container ${styles.section}`}>
      <div className={styles.head}>
        <h2 id="tools-heading" className={styles.heading}>
          Tools
        </h2>
        <p className={styles.intro}>Pick a tool. New ones land here as they are built.</p>
      </div>
      <ul className={styles.grid}>
        {getTools().map((tool) => (
          <li key={tool.slug}>
            {tool.status === 'available' ? (
              <a className={`${styles.card} ${styles.live}`} href={toolHref(tool.slug)}>
                <CardBody tool={tool} />
              </a>
            ) : (
              <div className={styles.card}>
                <CardBody tool={tool} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```
The section needs an accessible name "Tools" for the test: `aria-labelledby="tools-heading"` on a `<section>` gives it the `region` role named "Tools".

`apps/web/src/components/ToolGrid.module.css`:
```css
.section {
  padding-top: var(--space-section);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 2rem;
  margin-bottom: 1.75rem;
}

.heading {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
}

.intro {
  color: var(--text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.card {
  display: block;
  height: 100%;
  padding: 1.25rem;
  color: inherit;
  text-decoration: none;
  background-color: var(--surface);
  background-image: var(--grain);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-m);
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.9rem;
  margin-bottom: 0.9rem;
  border-bottom: 1.5px dashed var(--border);
}

.category {
  font: 500 0.75rem/1 var(--ff-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.name {
  font-size: 1.35rem;
  font-weight: 700;
}

.tagline {
  margin-top: 0.4rem;
  color: var(--text-muted);
}

.live {
  border-color: var(--edge);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.live:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0 var(--edge);
}
```

`apps/web/src/components/LocalSection.tsx`:
```tsx
import styles from './LocalSection.module.css';

const POINTS = [
  {
    title: 'Nothing is uploaded',
    body: 'Everything you enter is saved in your browser. We never see your clients or your numbers.',
  },
  {
    title: 'Works without internet',
    body: 'Install it once and it opens on a train, on a flight or on bad Wi-Fi.',
  },
  {
    title: 'Back up when you like',
    body: 'Export everything as one file and restore it on another device.',
  },
] as const;

export function LocalSection() {
  return (
    <section aria-labelledby="local-heading" className={`container ${styles.section}`}>
      <h2 id="local-heading" className={styles.heading}>
        Built to stay out of your way
      </h2>
      <div className={styles.grid}>
        {POINTS.map((point) => (
          <div key={point.title} className={styles.point}>
            <h3 className={styles.title}>{point.title}</h3>
            <p className={styles.body}>{point.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

`apps/web/src/components/LocalSection.module.css`:
```css
.section {
  padding-top: var(--space-section);
}

.heading {
  max-width: 16ch;
  font-size: clamp(2rem, 4.4vw, 3.4rem);
  font-weight: 800;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  margin-top: 2.25rem;
  border-top: 1.5px solid var(--edge);
}

@media (min-width: 52rem) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .point + .point {
    border-left: 1.5px dashed var(--border);
  }
}

.point {
  padding: 1.5rem 1.5rem 0.5rem 0;
}

@media (min-width: 52rem) {
  .point {
    padding-left: 1.75rem;
  }

  .point:first-child {
    padding-left: 0;
  }
}

.title {
  font-size: 1.35rem;
  font-weight: 700;
}

.body {
  margin-top: 0.6rem;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Compose the page**

Replace `apps/web/app/page.tsx` with:
```tsx
import { Hero } from '../src/components/Hero';
import { LocalSection } from '../src/components/LocalSection';
import { ToolGrid } from '../src/components/ToolGrid';

export default function Home() {
  return (
    <main id="main">
      <Hero />
      <ToolGrid />
      <LocalSection />
    </main>
  );
}
```

- [ ] **Step 6: Run tests, typecheck and build**

Run: `pnpm --filter @solokit/web test`
Expected: PASS (all web tests so far, including 6 home tests).
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.
Run: `pnpm build`
Expected: "Compiled successfully"; `grep -c "Paperwork for" apps/web/out/index.html` prints `1`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): build the home page

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tool pages, privacy page and 404

**Files:**
- Create: `apps/web/src/components/PageShell.tsx`, `PageShell.module.css`
- Create: `apps/web/app/tools/[slug]/page.tsx`, `apps/web/app/privacy/page.tsx`, `apps/web/app/not-found.tsx`
- Test: `apps/web/src/tool-page.test.tsx`, `apps/web/src/privacy.test.tsx`

**Interfaces:**
- Consumes: `getTools`, `getToolBySlug`, `TOOL_CATEGORY_LABELS` from `@solokit/registry`; `Badge`, `Button` from `@solokit/ui`.
- Produces:
  - `PageShell` props: `{ eyebrow?: string; title: string; lede?: string; children: ReactNode }`; renders `<main id="main">` with one `<h1>`.
  - Tool route `/tools/[slug]/`: `generateStaticParams()`, `generateMetadata({ params })`, default async page (`dynamicParams = false`; unknown slug calls `notFound()`).
  - `/privacy/` page and a custom 404.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/tool-page.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getTools } from '@solokit/registry';
import ToolPage, { generateMetadata, generateStaticParams } from '../app/tools/[slug]/page';

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('tool route', () => {
  it('pre-renders a page for every registry tool', () => {
    expect(generateStaticParams()).toEqual(getTools().map((tool) => ({ slug: tool.slug })));
  });

  it('sets the page title from the tool name', async () => {
    const metadata = await generateMetadata(params('invoice'));
    expect(metadata.title).toBe('Invoice generator');
    expect(metadata.description).toContain('GST');
  });

  it('shows a coming-soon page for tools that are not built yet', async () => {
    render(await ToolPage(params('quote')));
    expect(screen.getByRole('heading', { level: 1, name: 'Quote generator' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all tools' })).toHaveAttribute('href', '/#tools');
  });

  it('answers 404 for an unknown tool', async () => {
    await expect(ToolPage(params('does-not-exist'))).rejects.toThrow();
  });
});
```

`apps/web/src/privacy.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from '../app/privacy/page';

describe('privacy page', () => {
  it('explains where data lives and what that means', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What stays on your device' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What we do not collect' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Back up your data' })).toBeInTheDocument();
    expect(screen.getByText(/clearing your browser data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- tool-page privacy`
Expected: FAIL (cannot resolve the page modules).

- [ ] **Step 3: Implement the page shell**

`apps/web/src/components/PageShell.tsx`:
```tsx
import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: ReactNode;
}

export function PageShell({ eyebrow, title, lede, children }: PageShellProps) {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <header className={styles.head}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </main>
  );
}
```

`apps/web/src/components/PageShell.module.css`:
```css
.page {
  padding-top: clamp(2.5rem, 6vw, 4.5rem);
}

.head {
  max-width: 44rem;
}

.eyebrow {
  margin-bottom: 1rem;
  font: 500 0.8rem/1 var(--ff-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-text);
}

.title {
  font-size: clamp(2.4rem, 6vw, 4.2rem);
  font-weight: 800;
}

.lede {
  margin-top: 1rem;
  font-size: 1.2rem;
  color: var(--text-muted);
}

.body {
  max-width: 44rem;
  margin-top: 2.5rem;
}

.body h2 {
  margin: 2.25rem 0 0.6rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.body p + p {
  margin-top: 0.9rem;
}

.body a {
  text-decoration-color: var(--amber);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}
```

- [ ] **Step 4: Implement the routes**

`apps/web/app/tools/[slug]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TOOL_CATEGORY_LABELS, getToolBySlug, getTools } from '@solokit/registry';
import { Badge, Button } from '@solokit/ui';
import { PageShell } from '../../../src/components/PageShell';

export const dynamicParams = false;

interface ToolPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getTools().map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};
  return { title: tool.name, description: tool.description };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  return (
    <PageShell eyebrow={TOOL_CATEGORY_LABELS[tool.category]} title={tool.name} lede={tool.tagline}>
      <p>{tool.description}</p>
      <div
        style={{
          display: 'grid',
          gap: '0.9rem',
          justifyItems: 'start',
          marginTop: '2rem',
          padding: '1.5rem',
          border: '1.5px dashed var(--border)',
          borderRadius: 'var(--radius-m)',
        }}
      >
        <Badge tone="soon">Coming soon</Badge>
        <p>
          This tool is not ready yet. Every tool on SoloKit works the same way: free, in your browser, with no account.
        </p>
        <Button href="/#tools" variant="secondary">
          Browse all tools
        </Button>
      </div>
    </PageShell>
  );
}
```

`apps/web/app/privacy/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { PageShell } from '../../src/components/PageShell';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'SoloKit keeps your data on your device. Here is exactly what that means.',
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="How it works"
      title="Privacy"
      lede="SoloKit is built so that your business data never needs to leave your device."
    >
      <h2>What stays on your device</h2>
      <p>
        Your business details, clients, invoices and themes are saved in your browser's own storage (IndexedDB). They are
        read and written by the page on your device. There is no SoloKit server that receives them.
      </p>

      <h2>What we do not collect</h2>
      <p>
        There are no accounts, no cookies and no analytics scripts on this site today. Fonts are served from this site
        rather than from a third party, so visiting does not send your address to anyone else.
      </p>

      <h2>Back up your data</h2>
      <p>
        Because the data lives in your browser, clearing your browser data erases it. Export a backup file regularly and
        keep it somewhere safe. You can restore it on any device.
      </p>

      <h2>Tax information</h2>
      <p>
        The GST and TDS calculations follow rules that were last checked on the date shown in the footer. They are not
        tax advice; confirm anything important with your chartered accountant.
      </p>
    </PageShell>
  );
}
```

`apps/web/app/not-found.tsx`:
```tsx
import { Button } from '@solokit/ui';
import { PageShell } from '../src/components/PageShell';

export default function NotFound() {
  return (
    <PageShell eyebrow="Error 404" title="That page does not exist" lede="The link may be old, or the tool may not be built yet.">
      <Button href="/">Go to the home page</Button>
    </PageShell>
  );
}
```

- [ ] **Step 5: Run tests, typecheck and build**

Run: `pnpm --filter @solokit/web test`
Expected: PASS (all web tests).
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.
Run: `pnpm build`
Expected: route table lists `/`, `/privacy`, `/tools/[slug]` with 7 prerendered paths, and `/_not-found`.
Run: `ls apps/web/out/tools apps/web/out/privacy`
Expected: one folder per tool slug (each with `index.html`) and `privacy/index.html`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add tool pages, privacy page and 404

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Installable and offline (PWA)

**Files:**
- Create: `apps/web/scripts/generate-icons.mjs`
- Create: `apps/web/public/manifest.webmanifest`, `apps/web/public/sw.js`
- Create (generated, committed): `apps/web/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
- Create: `apps/web/app/icon.svg`
- Create: `apps/web/src/ServiceWorkerRegister.tsx`
- Modify: `apps/web/app/layout.tsx`
- Test: `apps/web/src/pwa.test.ts`, `apps/web/src/ServiceWorkerRegister.test.tsx`

**Interfaces:**
- Produces:
  - `ServiceWorkerRegister` (client component, renders nothing; registers `/sw.js` only when `process.env.NODE_ENV === 'production'` and the browser supports service workers)
  - Web manifest with name, short name, `start_url: "/"`, `display: "standalone"`, colours, and 192/512/maskable icons
  - Service worker caching strategy: precache `/`, `/privacy/`, `/manifest.webmanifest`; navigations are network-first with a cached fallback (then `/`); `/_next/static/` is cache-first; other same-origin GETs are stale-while-revalidate

- [ ] **Step 1: Write the favicon and the icon generator**

`apps/web/app/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0B1B3A"/>
  <path d="M17 11h30v41.6l-5-3.4-5 3.4-5-3.4-5 3.4-5-3.4-5 3.4z" fill="#FAF8F4"/>
  <path d="M24 24h16M24 32h10" stroke="#0B1B3A" stroke-width="3.2" stroke-linecap="round" fill="none"/>
  <circle cx="44" cy="14" r="5" fill="#10B981"/>
</svg>
```

`apps/web/scripts/generate-icons.mjs`:
```js
// Renders the app icons to PNG. Run with: pnpm --filter @solokit/web icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// `inset` shrinks the artwork so maskable icons keep it inside the safe zone.
function svg({ rounded, inset }) {
  const scale = 1 - inset * 2;
  const offset = 64 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" ${rounded ? 'rx="14"' : ''} fill="#0B1B3A"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M17 11h30v41.6l-5-3.4-5 3.4-5-3.4-5 3.4-5-3.4-5 3.4z" fill="#FAF8F4"/>
    <path d="M24 24h16M24 32h10" stroke="#0B1B3A" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    <circle cx="44" cy="14" r="5" fill="#10B981"/>
  </g>
</svg>`;
}

const icons = [
  { file: 'icon-192.png', size: 192, rounded: true, inset: 0 },
  { file: 'icon-512.png', size: 512, rounded: true, inset: 0 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, inset: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, inset: 0.06 },
];

for (const { file, size, rounded, inset } of icons) {
  const png = new Resvg(svg({ rounded, inset }), { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(outDir, file), png);
  console.log(`wrote ${file} (${size}x${size})`);
}
```

Run: `pnpm --filter @solokit/web icons`
Expected: four `wrote ...` lines and the four PNG files exist in `apps/web/public/icons/`. If `@resvg/resvg-js` fails to load on this machine, report it instead of working around it.

- [ ] **Step 2: Write the manifest and the service worker**

`apps/web/public/manifest.webmanifest`:
```json
{
  "name": "SoloKit",
  "short_name": "SoloKit",
  "description": "Free tools for freelancers and solopreneurs. Works offline and keeps your data on your device.",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#faf8f4",
  "theme_color": "#0b1b3a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`apps/web/public/sw.js`:
```js
// SoloKit service worker: makes the site installable and usable offline.
// Bump CACHE when this file's strategy changes so old caches are removed.
const CACHE = 'solokit-v1';
const PRECACHE = ['/', '/privacy/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit || (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
```

- [ ] **Step 3: Write the failing tests**

`apps/web/src/pwa.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicDir = join(__dirname, '..', 'public');
const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8')) as {
  name: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; purpose: string }[];
};

/** Reads width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(path);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('web manifest', () => {
  it('describes an installable standalone app', () => {
    expect(manifest.name).toBe('SoloKit');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('has a 192px, a 512px and a maskable icon', () => {
    const sizes = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`);
    expect(sizes).toContain('192x192:any');
    expect(sizes).toContain('512x512:any');
    expect(sizes).toContain('512x512:maskable');
  });

  it('points every icon at a PNG of the declared size', () => {
    for (const icon of manifest.icons) {
      const file = join(publicDir, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [width, height] = icon.sizes.split('x').map(Number);
      expect(pngSize(file)).toEqual([width, height]);
    }
  });

  it('ships an apple touch icon', () => {
    expect(pngSize(join(publicDir, 'icons', 'apple-touch-icon.png'))).toEqual([180, 180]);
  });
});

describe('service worker file', () => {
  const source = readFileSync(join(publicDir, 'sw.js'), 'utf8');

  it('precaches the shell and handles fetches', () => {
    expect(source).toContain("addEventListener('install'");
    expect(source).toContain("addEventListener('fetch'");
    expect(source).toContain("'/privacy/'");
  });

  it('only handles same-origin GET requests', () => {
    expect(source).toContain("request.method !== 'GET'");
    expect(source).toContain('url.origin !== self.location.origin');
  });
});
```

`apps/web/src/ServiceWorkerRegister.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

function stubServiceWorker() {
  const register = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
  return register;
}

afterEach(() => {
  vi.unstubAllEnvs();
  // @ts-expect-error remove the stub between tests
  delete navigator.serviceWorker;
});

describe('ServiceWorkerRegister', () => {
  it('registers the service worker in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = stubServiceWorker();
    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('stays out of the way during development and tests', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const register = stubServiceWorker();
    render(<ServiceWorkerRegister />);
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing in browsers without service worker support', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
  });
});
```

Run: `pnpm --filter @solokit/web test -- pwa ServiceWorkerRegister`
Expected: `pwa.test.ts` PASSES (the files exist from Steps 1 and 2); `ServiceWorkerRegister.test.tsx` FAILS (cannot resolve `./ServiceWorkerRegister`).

- [ ] **Step 4: Implement the registration component and wire the layout**

`apps/web/src/ServiceWorkerRegister.tsx`:
```tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The site works without the service worker; offline support is a bonus.
    });
  }, []);

  return null;
}
```

In `apps/web/app/layout.tsx`:
- add the import `import { ServiceWorkerRegister } from '../src/ServiceWorkerRegister';`
- extend `metadata` with:
```ts
  manifest: '/manifest.webmanifest',
  icons: { apple: '/icons/apple-touch-icon.png' },
```
- render `<ServiceWorkerRegister />` as the last child of `<body>`, after `<SiteFooter {...getFooterProps()} />`.

- [ ] **Step 5: Run tests, typecheck and build**

Run: `pnpm --filter @solokit/web test`
Expected: PASS (all web tests; pwa 6, ServiceWorkerRegister 3).
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.
Run: `pnpm build`
Expected: "Compiled successfully".
Run: `ls apps/web/out/sw.js apps/web/out/manifest.webmanifest apps/web/out/icons`
Expected: all present. `grep -o 'rel="manifest"[^>]*' apps/web/out/index.html` prints a manifest link.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): make the site installable and offline-capable

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: README and full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README**

Replace the `## Status`, `## Layout` and `## Develop` sections of `README.md` with:

```markdown
## Status

- Done: monorepo, core primitives, India GST/TDS engine, design system, app shell, tool registry, local storage layer, installable offline site.
- Next: the invoice generator tool.

## Layout

- `apps/web` the website (Next.js, static export, installable PWA)
- `packages/core` country-agnostic primitives (integer-paise money, amount in words, invoice numbering)
- `packages/tax-engines` `TaxEngine` interface, country list, India GST engine
- `packages/ui` design tokens and shared components (header, footer, buttons)
- `packages/registry` the list of tools; drives the home page, tool routes and footer
- `packages/storage` `DataStore` interface with IndexedDB and in-memory adapters
- `docs/ideas.md` backlog of tool ideas
- `docs/superpowers/specs` design specs
- `docs/superpowers/plans` implementation plans

## Develop

    npm install -g pnpm
    pnpm install
    pnpm dev          # http://localhost:3000
    pnpm test
    pnpm typecheck
    pnpm build        # static site in apps/web/out
    pnpm preview      # serve apps/web/out (try the offline mode here)

The service worker only registers in production builds, so test offline behaviour with `pnpm build` then `pnpm preview`.

Add a tool by creating its package under `packages/tools/` and adding one entry to `packages/registry/src/tools.ts`.

Tax rates and thresholds are data (`packages/tax-engines/src/in/rules.ts`) with an "as of" date. They are not tax advice; verify with a chartered accountant.
```

- [ ] **Step 2: Run the whole suite, typecheck and build from the root**

Run: `pnpm install`
Expected: exits 0.
Run: `pnpm test`
Expected: every package passes (core, tax-engines, ui, registry, storage, web), no failures.
Run: `pnpm typecheck`
Expected: no errors in any package.
Run: `pnpm build`
Expected: "Compiled successfully".

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: update README for the app shell

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(The controller then runs the site and checks it in a real browser, including the installable/offline behaviour and the visual details, before the final review.)

---

## Self-review

**Spec coverage (for this plan's scope):**
- Monorepo packages `ui`, `storage` and the tool registry; Next.js static export; PWA, offline: Tasks 1-5, 10.
- Storage behind an interface with IndexedDB now and room for sync later; JSON backup/restore primitives (`exportAll`/`importAll`); fallback when IndexedDB is blocked: Tasks 4, 6.
- Brand: palette, Bricolage Grotesque / Geist / JetBrains Mono (self-hosted, latin + latin-ext), paper cards with grain, trust strip, giant-wordmark footer with glow, "Made in India", privacy badge, animated "Back to top", dark mode: Tasks 1, 2, 5, 7, 8.
- Country picker with "Coming soon" for non-India countries: Task 2 footer, Task 5 config. (A selectable picker inside the invoice tool belongs to Plan 3.)
- Home grid generated from the registry; per-tool statically generated, indexable pages with metadata: Tasks 3, 8, 9.
- Quality floor (skip link, landmarks, focus ring, reduced motion, responsive): Tasks 1, 2, 5, 8.
- Tax disclaimer with date in the footer and privacy page: Tasks 2, 9.
- Deferred to Plan 3 on purpose: invoice tool, seller profile, themes, logo, invoice fonts, PDF, backup UI, HSN/SAC list, UPI QR, Playwright. Note for Plan 3: the logo is stored as a data URL inside the profile record (JSON-backup friendly) rather than as a separate Blob.
- Turborepo stays deferred (still one build target).

**Placeholder scan:** none; every code step has complete code.

**Type consistency:** `NavLink`, `SiteHeaderProps`, `SiteFooterProps`, `FooterTool`, `FooterCountry` are defined in Task 2 and consumed in Task 5 (`site.ts`). `ToolDefinition`, `getTools`, `toolHref`, `TOOL_CATEGORY_LABELS` (Task 3) match their uses in Tasks 5, 8, 9. `DataStore`, `createIndexedDbStore`, `createMemoryStore` (Task 4) match Task 6. `computeDemo` (Task 7) matches `ReceiptDemo`. Hrefs consistently end in `/` (`trailingSlash: true`).
