import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TOOL_CATEGORY_LABELS, getToolBySlug, getTools } from '@solokit/registry';
import { Badge, Button } from '@solokit/ui';
import { PageShell } from '../../../src/components/PageShell';
import { TOOL_COMPONENTS } from '../../../src/tools';

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

  const Tool = TOOL_COMPONENTS[tool.slug];
  if (Tool) {
    return (
      <PageShell eyebrow={TOOL_CATEGORY_LABELS[tool.category]} title={tool.name} lede={tool.tagline} wide>
        <Tool />
      </PageShell>
    );
  }

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
