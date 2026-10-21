import type { ToolDefinition } from '@solokit/registry';
import { Button } from '@solokit/ui';
import { toolAppHref } from '../paths';
import styles from './ToolLanding.module.css';

const POINTS = ['Free, with no account to make', 'Everything stays on your device', 'Works without internet once opened'] as const;

/**
 * The public page of a ready tool, for people who find it in a search: what it does, and a way into the tool inside
 * the app. A first visit there asks for the business details once, then opens the tool.
 */
export function ToolLanding({ tool }: { tool: ToolDefinition }) {
  return (
    <div className={styles.landing}>
      <p className={styles.description}>{tool.description}</p>
      <ul className={styles.points}>
        {POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button href={toolAppHref(tool.slug)}>Open the {tool.name.toLowerCase()}</Button>
        <Button href="/#tools" variant="secondary">
          Browse all tools
        </Button>
      </div>
      <p className={styles.note}>First time here? You enter your business details once, in about two minutes, and every tool uses them.</p>
    </div>
  );
}
