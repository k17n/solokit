import { Hero } from '../src/components/Hero';
import { LocalSection } from '../src/components/LocalSection';
import { ToolGrid } from '../src/components/ToolGrid';
import styles from '../src/components/Home.module.css';

export default function Home() {
  return (
    <main id="main" className={styles.page}>
      <Hero />
      <ToolGrid />
      <LocalSection />
    </main>
  );
}
