import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: Variant;
    /** Rendered at the right edge, inside its own disc. */
    trailing?: ReactNode;
}

/**
 * Every button in the app.
 *
 * Pressing it sinks it: the surface drops a little and its shadow contracts at
 * the same time. Moving both together is what sells soft plastic - shrinking
 * the shadow alone reads as the light moving, not the object.
 *
 * Colour and background are always explicit. Left to the system they turn
 * near-white under the dark theme Android applies inside Telegram's WebView.
 */
export const Button = ({ children, variant = 'primary', trailing, className, ...rest }: Props) => (
    <button
        {...rest}
        className={cn(
            'group flex h-14 w-full items-center justify-center gap-3 rounded-pill px-7',
            'text-[17px] font-extrabold tracking-tight transition-all duration-150 ease-soft',
            'active:translate-y-[2px] active:scale-[0.985]',
            'disabled:pointer-events-none disabled:opacity-50',
            variant === 'primary' && 'bg-blue text-paper shadow-accent active:shadow-accent-press',
            // The hairline is not decoration: a white button can land on a white
            // shape - the mascot's silhouette does exactly that - and without an
            // edge of its own it dissolves into whatever it sits on.
            variant === 'ghost' && 'bg-surface text-blue shadow-soft-2 ring-1 ring-inset ring-line active:shadow-none',
            className,
        )}
    >
        <span>{children}</span>
        {trailing && (
            <span
                className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-pill text-[17px] leading-none',
                    'transition-transform duration-200 ease-soft group-active:translate-x-[2px]',
                    variant === 'primary' ? 'bg-paper/25 text-paper' : 'bg-blue-soft text-blue',
                )}
            >
                {trailing}
            </span>
        )}
    </button>
);
