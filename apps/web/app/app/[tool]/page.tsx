import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TOOL_CATEGORY_LABELS, getAvailableTools, getToolBySlug } from '@solokit/registry';
import { PageShell } from '../../../src/components/PageShell';
import { TOOL_COMPONENTS } from '../../../src/tools';

export const dynamicParams = false;

interface AppToolPageProps {
  params: Promise<{ tool: string }>;
}

/** Every ready tool that has a component gets a page in the app. */
export function generateStaticParams() {
  return getAvailableTools()
    .filter((tool) => TOOL_COMPONENTS[tool.slug] !== undefined)
    .map((tool) => ({ tool: tool.slug }));
}

export async function generateMetadata({ params }: AppToolPageProps): Promise<Metadata> {
  const tool = getToolBySlug((await params).tool);
  // The tool's landing page outside the app is the one for search engines.
  return tool ? { title: tool.name, robots: { index: false } } : {};
}

export default async function AppToolPage({ params }: AppToolPageProps) {
  const tool = getToolBySlug((await params).tool);
  const Tool = tool ? TOOL_COMPONENTS[tool.slug] : undefined;
  if (!tool || !Tool) notFound();
  return (
    <PageShell eyebrow={TOOL_CATEGORY_LABELS[tool.category]} title={tool.name} wide compact>
      <Tool />
    </PageShell>
  );
}
