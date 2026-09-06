import { createElement, useMemo, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export const Card = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={`glass-panel rounded-[22px] border border-white/75 bg-surface/94 shadow-card ${className}`} {...props} />
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    tone?: 'primary' | 'secondary' | 'danger' | 'quiet';
    icon?: IconName;
}

export const Button = ({ tone = 'primary', icon, className = '', children, ...props }: ButtonProps) => {
    const tones = {
        primary: 'bg-accent text-white shadow-[0_9px_24px_rgb(var(--c-accent)/0.24)]',
        secondary: 'border border-line bg-surface text-text',
        danger: 'bg-alert text-white',
        quiet: 'bg-transparent text-accent-deep',
    };
    return (
        <button type="button" {...props} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-4 text-[14px] font-extrabold transition duration-quick ease-out active:translate-y-0.5 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45 ${tones[tone]} ${className}`}>
            {icon && <Icon name={icon} className="h-5 w-5" />}
            {children}
        </button>
    );
};

export const PageHeader = ({ eyebrow, title, description, onBack, action }: { eyebrow?: string; title: string; description?: string; onBack?: () => void; action?: ReactNode }) => (
    <header className="surface">
        <div className="flex items-start gap-3">
            {onBack && (
                <button type="button" onClick={onBack} aria-label="Назад" className="glass-panel mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-white/70 bg-surface/85 text-text-soft shadow-sm">
                    <Icon name="back" />
                </button>
            )}
            <div className="min-w-0 flex-1">
                {eyebrow && <p className="font-mono text-[9px] font-bold uppercase tracking-[0.23em] text-accent-deep">{eyebrow}</p>}
                <h1 className="mt-1 text-[34px] font-black leading-[0.95] tracking-[-0.045em]">{title}</h1>
                {description && <p className="mt-2 text-[13px] font-semibold leading-relaxed text-text-soft">{description}</p>}
            </div>
            {action}
        </div>
        <span className="mt-5 block h-px bg-text/12" />
    </header>
);

export const ProductPage = ({ children, nav, className = '' }: { children: ReactNode; nav?: ReactNode; className?: string }) => (
    <div className={`relative h-full overflow-hidden text-text ${className}`}>
        <main className={`product-scroll h-full overflow-y-auto px-5 pt-[max(24px,env(safe-area-inset-top))] ${nav ? 'pb-28' : 'pb-8'}`}>
            {children}
        </main>
        {nav}
    </div>
);

export const StatusPill = ({ tone = 'blue', children }: { tone?: 'blue' | 'green' | 'warm' | 'red' | 'gray'; children: ReactNode }) => {
    const tones = {
        blue: 'bg-accent-tint text-accent-deep', green: 'bg-good/14 text-good', warm: 'bg-warm/15 text-[#91520e]',
        red: 'bg-alert/14 text-alert', gray: 'bg-text/7 text-text-soft',
    };
    return <span className={`inline-flex rounded-pill px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${tones[tone]}`}>{children}</span>;
};

export const EmptyState = ({ icon = 'spark', title, copy, action }: { icon?: IconName; title: string; copy: string; action?: ReactNode }) => (
    <Card className="mt-6 flex flex-col items-center px-6 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-tint text-accent"><Icon name={icon} className="h-7 w-7" /></span>
        <h2 className="mt-4 text-[21px] font-black">{title}</h2>
        <p className="mt-2 max-w-[280px] text-[13px] font-semibold leading-relaxed text-text-soft">{copy}</p>
        {action && <div className="mt-5">{action}</div>}
    </Card>
);

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
    <label className="block">
        <span className="text-[12px] font-extrabold text-text">{label}</span>
        {hint && <span className="ml-2 text-[10px] font-semibold text-text-faint">{hint}</span>}
        <span className="mt-1.5 block">{children}</span>
    </label>
);

export const inputClass = 'w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[14px] font-semibold text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-text-faint';

const ALLOWED_TAGS = new Set(['p', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'br']);

const safeRichNodes = (html: string): ReactNode[] => {
    if (typeof DOMParser === 'undefined') return [html.replace(/<[^>]+>/g, '')];
    const document = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    let key = 0;
    const walk = (node: Node): ReactNode => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (!(node instanceof HTMLElement)) return null;
        const children = Array.from(node.childNodes).map(walk);
        const tag = node.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) return children;
        return createElement(tag, { key: key++ }, ...children);
    };
    return Array.from(document.body.childNodes).map(walk);
};

export const RichText = ({ html, className = '' }: { html: string; className?: string }) => {
    const content = useMemo(() => safeRichNodes(html), [html]);
    return <div className={`rich-text text-[14px] font-medium leading-[1.7] text-text-soft ${className}`}>{content}</div>;
};
