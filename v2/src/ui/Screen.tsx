import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * The phone-shaped frame every screen sits in. Centres on desktop, fills the
 * viewport on a phone, and clips the decorative planes that overhang.
 */
export const Screen = ({ children, className }: { children: ReactNode; className?: string }) => (
    <main className={cn('relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden', className)}>
        {children}
    </main>
);
