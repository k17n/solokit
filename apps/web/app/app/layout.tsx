import type { ReactNode } from 'react';
import { AppShell } from '../../src/app-shell/AppShell';

/** Everything under /app/ shares one shell, which stays mounted while people move between its pages. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
