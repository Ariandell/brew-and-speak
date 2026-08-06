import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * A skewed slab. The design leans on these heavily, so the skew lives here
 * rather than being re-typed at every call site - change the angle once and
 * every panel follows.
 */
export const Panel = ({
    children,
    tilt = 'left',
    className,
}: {
    children?: ReactNode;
    tilt?: 'left' | 'right' | 'none';
    className?: string;
}) => (
    <div
        className={cn(
            tilt === 'left' && 'skew-plane',
            tilt === 'right' && 'skew-plane-reverse',
            className,
        )}
    >
        {children}
    </div>
);
