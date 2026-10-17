import { TOOL_CATEGORY_LABELS, getTools, toolHref, type ToolDefinition } from '@solokit/registry';
import { ToolIcon } from './ToolIcon';
import styles from './ToolGrid.module.css';

/** A one-line sample shown on each ready tool's showcase canvas; decoration, so it stays out of the link's name. */
const SHOWCASE: Record<string, string> = {
  invoice: '₹1,18,000 · due in 14 days',
  contract: 'Mutual NDA · ready to review',
};

function ReadyCard({ tool }: { tool: ToolDefinition }) {
  return (
    <a className={styles.card} href={toolHref(tool.slug)}>
      <div className={styles.media} data-tool={tool.slug} aria-hidden="true">
        <span className={styles.mediaChip}>
          <span className={styles.mediaAvatar} />
          {SHOWCASE[tool.slug] ?? tool.tagline}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <ToolIcon slug={tool.slug} category={tool.category} />
          <span className={styles.category}>{TOOL_CATEGORY_LABELS[tool.category]}</span>
          <span className={styles.ready}>Ready</span>
        </div>
        <h4 className={styles.name}>{tool.name}</h4>
        <p className={styles.tagline}>{tool.tagline}</p>
        <span className={styles.open} aria-hidden="true">
          Open tool <span className={styles.arrow}>→</span>
        </span>
      </div>
    </a>
  );
}

function SoonRow({ tool }: { tool: ToolDefinition }) {
  return (
    <div className={styles.row}>
      <ToolIcon slug={tool.slug} category={tool.category} />
      <div className={styles.rowText}>
        <h4 className={styles.rowName}>{tool.name}</h4>
        <p className={styles.rowTagline}>{tool.tagline}</p>
      </div>
      <span className={styles.rowCategory}>{TOOL_CATEGORY_LABELS[tool.category]}</span>
      <span className={styles.soon}>Coming soon</span>
    </div>
  );
}

function ToolGroup({ label, tools, ready }: { label: string; tools: ToolDefinition[]; ready: boolean }) {
  if (tools.length === 0) return null;
  return (
    <div className={styles.group}>
      <h3 className={styles.groupLabel}>{label}</h3>
      <ul role="list" className={ready ? styles.grid : styles.list}>
        {tools.map((tool) => (
          <li key={tool.slug}>{ready ? <ReadyCard tool={tool} /> : <SoonRow tool={tool} />}</li>
        ))}
      </ul>
    </div>
  );
}

export function ToolGrid() {
  const tools = getTools();
  const ready = tools.filter((tool) => tool.status === 'available');
  const soon = tools.filter((tool) => tool.status !== 'available');
  return (
    <section id="tools" aria-labelledby="tools-heading" className={`container ${styles.section}`}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Toolkit</p>
        <h2 id="tools-heading" className={styles.heading}>
          Tools
        </h2>
        <p className={styles.intro}>Pick a tool. New ones land here as they are built.</p>
      </div>
      <ToolGroup label="Ready to use" tools={ready} ready />
      <ToolGroup label="On the way" tools={soon} ready={false} />
    </section>
  );
}
