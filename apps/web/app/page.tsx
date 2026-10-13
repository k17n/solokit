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
