'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useConfirmLeave } from '../workspace/unsavedGuard';

export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
}

/**
 * A link between pages of the app. It moves without reloading, so the app shell and the open Business stay put, and it
 * asks first when an editor holds unsaved work (a page load would only get the browser's own warning). A click with a
 * modifier key, or any other button, is left to the browser, so "open in a new tab" still works.
 */
export function AppLink({ href, children, onClick, ...rest }: AppLinkProps) {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (await confirmLeave('leave')) router.push(href);
  }

  return (
    <Link href={href} {...rest} onClick={(event) => void handleClick(event)}>
      {children}
    </Link>
  );
}
