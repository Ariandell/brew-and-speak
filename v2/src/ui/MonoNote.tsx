import { cn } from '../lib/cn';

/** The small monospaced annotations the style uses as texture. */
export const MonoNote = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={cn('font-mono text-[10px] uppercase tracking-widest', className)}>{children}</span>
);
