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
      <ul role="list" className={styles.grid}>
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
