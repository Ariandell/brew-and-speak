import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';

/** How far off the page the card sits. Nothing else about it varies. */
type Level = 1 | 2 | 3;

const ELEVATION: Record<Level, string> = {
    1: 'shadow-soft-1',
    2: 'shadow-soft-2',
    3: 'shadow-soft-3',
};

interface Props {
    children?: ReactNode;
    level?: Level;
    className?: string;
    style?: CSSProperties;
}

/**
 * A soft slab - the one surface this design is built from.
 *
 * Everything is made of the same material, so the only thing a card decides is
 * how high it floats. Keeping elevation to three named steps is what stops
 * screens inventing their own shadows, which is how a soft style turns muddy.
 */
export const Card = ({ children, level = 2, className, style }: Props) => (
    <div className={cn('rounded-lg bg-surface', ELEVATION[level], className)} style={style}>
        {children}
    </div>
);
