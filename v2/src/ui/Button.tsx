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
 * Every button in the app. The hard offset shadow and the skew are what make
 * the style, so they belong in one file - the previous app repeated button
 * styling inline at forty call sites, which is why changing it was a day's work.
 *
 * Colour and background are always explicit: left to the system they turn
 * near-white under the dark theme Android applies inside Telegram's WebView.
 */
export const Button = ({ children, variant = 'primary', trailing, className, ...rest }: Props) => (
    <button
        {...rest}
        className={cn(
            'group relative flex h-16 w-full -skew-x-12 items-center justify-between overflow-hidden px-6',
            'text-[22px] font-black uppercase italic transition-all duration-150 ease-out',
            'disabled:pointer-events-none disabled:opacity-50',
            variant === 'primary' && [
                'bg-blue-hot text-paper shadow-[8px_8px_0_#0F1B33]',
                'hover:-translate-y-1 hover:translate-x-1 hover:shadow-[12px_12px_0_#0F1B33]',
                'active:translate-x-2 active:translate-y-2 active:shadow-none',
            ].join(' '),
            variant === 'ghost' && 'border-2 border-ink bg-paper text-ink shadow-[4px_4px_0_#0F1B33]',
            className,
        )}
    >
        <span className="glare absolute left-[-100%] top-0 h-full w-1/2 skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <span className="relative z-10 tracking-widest drop-shadow-md">{children}</span>
        {trailing && (
            <span className="relative z-10 flex h-10 w-10 skew-x-12 items-center justify-center rounded-full bg-paper text-[24px] font-bold text-blue-hot shadow-inner transition-transform duration-200 group-hover:rotate-45">
                {trailing}
            </span>
        )}
    </button>
);
