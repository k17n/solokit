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
      <h4 className={styles.name}>{tool.name}</h4>
      <p className={styles.tagline}>{tool.tagline}</p>
    </>
  );
}

function ToolGroup({ label, tools }: { label: string; tools: ToolDefinition[] }) {
  if (tools.length === 0) return null;
  return (
    <div className={styles.group}>
      <h3 className={styles.groupLabel}>{label}</h3>
      <ul role="list" className={styles.grid}>
        {tools.map((tool) => (
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
        <h2 id="tools-heading" className={styles.heading}>
          Tools
        </h2>
        <p className={styles.intro}>Pick a tool. New ones land here as they are built.</p>
      </div>
      <ToolGroup label="Ready to use" tools={ready} />
      <ToolGroup label="On the way" tools={soon} />
    </section>
  );
}
