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
