import type { ToolCategory } from '@solokit/registry';
import styles from './ToolIcon.module.css';

type Hue = 'orange' | 'blue' | 'teal' | 'purple' | 'pink';

const GLYPHS: Record<string, string> = {
  invoice: 'M5 3h6v10l-1-.7-1 .7-1-.7-1 .7-1-.7-1 .7zM6.5 6h3M6.5 8.5h2',
  contract: 'M5 3h4.5L12 5.5V13H5zM9.5 3v2.5H12M6.75 10.5c.6-.9 1.2-.9 1.6 0s.9.9 1.65-.1',
  'rate-calculator': 'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3zM8 5.5V8l1.75 1.25',
  'time-tracker': 'M8 4.5a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5zM8 6.5v2.25M6.75 2.75h2.5',
  'qr-code': 'M4 4h3v3H4zM9 4h3v3H9zM4 9h3v3H4zM9.5 9.5h1v1h-1zM11 11h1v1h-1z',
  'email-signature': 'M3.5 5h9v6.5h-9zM3.5 5.25 8 8.75l4.5-3.5',
};

const HUES: Record<string, Hue> = {
  invoice: 'orange',
  contract: 'blue',
  'rate-calculator': 'teal',
  'time-tracker': 'purple',
  'qr-code': 'pink',
  'email-signature': 'teal',
};

const CATEGORY_HUES: Record<ToolCategory, Hue> = {
  money: 'orange',
  clients: 'blue',
  marketing: 'pink',
  productivity: 'purple',
  documents: 'teal',
};

export interface ToolIconProps {
  slug: string;
  category?: ToolCategory;
  size?: 'sm' | 'md' | 'lg';
}

/** A small rounded tile with a gradient and a white line glyph; one hue per tool, decorative only. */
export function ToolIcon({ slug, category = 'documents', size = 'md' }: ToolIconProps) {
  const hue = HUES[slug] ?? CATEGORY_HUES[category];
  return (
    <span className={`${styles.tile} ${styles[size]}`} data-hue={hue} aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d={GLYPHS[slug] ?? GLYPHS.contract} />
      </svg>
    </span>
  );
}
