export type IconName =
    | 'home' | 'course' | 'cards' | 'chat' | 'profile' | 'arrow' | 'back'
    | 'homework' | 'students' | 'chart' | 'broadcast' | 'lock' | 'check'
    | 'clock' | 'search' | 'send' | 'edit' | 'close' | 'plus' | 'spark'
    | 'calendar' | 'trash' | 'eye';

interface Props {
    name: IconName;
    className?: string;
}

export const Icon = ({ name, className = 'h-5 w-5' }: Props) => {
    const common = {
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        strokeWidth: 1.8,
    };

    return (
        <svg aria-hidden className={className} viewBox="0 0 24 24" {...common}>
            {name === 'home' && <path d="M3.8 10.5 12 3.8l8.2 6.7v8.8a1 1 0 0 1-1 1h-4.5v-6.2H9.3v6.2H4.8a1 1 0 0 1-1-1z" />}
            {name === 'course' && <path d="M5 4.2h11.2A2.8 2.8 0 0 1 19 7v12.8H7.2A2.2 2.2 0 0 1 5 17.6zm0 13.4a2.2 2.2 0 0 1 2.2-2.2H19M8.5 8h6.8" />}
            {name === 'cards' && <path d="m7 5.5 11.2-2.3 2.4 11.6-11.2 2.3zM7 7H3.4v13.8h11.8v-4.7" />}
            {name === 'chat' && <path d="M4 5.2h16v11.3H9l-5 3.3zm4 4h8M8 12.5h5" />}
            {name === 'profile' && <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.6-4 2.7-6 6.5-6s5.9 2 6.5 6" /></>}
            {name === 'arrow' && <path d="M5 12h13m-5-5 5 5-5 5" />}
            {name === 'back' && <path d="M19 12H6m5-5-5 5 5 5" />}
            {name === 'homework' && <path d="M6 3.8h9l3 3V20H6zm9 0V7h3M9 11h6M9 14.5h4" />}
            {name === 'students' && <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.2" /><path d="M3.8 20c.5-4 2.2-6 5.2-6s4.8 2 5.2 6M14.5 14.7c3.3-.7 5.2 1.1 5.7 4.2" /></>}
            {name === 'chart' && <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />}
            {name === 'broadcast' && <path d="M4 9v6l11 3V6zm11 0c2 .4 3 1.4 3 3s-1 2.6-3 3M6.5 15.7 8 20h3" />}
            {name === 'lock' && <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>}
            {name === 'check' && <path d="m5 12 4 4L19 6" />}
            {name === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
            {name === 'search' && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" /></>}
            {name === 'send' && <path d="m3 4 18 8-18 8 3-8zm3 8h15" />}
            {name === 'edit' && <path d="m4 20 4.3-1 10-10-3.3-3.3-10 10zm9.5-12.8 3.3 3.3" />}
            {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
            {name === 'plus' && <path d="M12 5v14M5 12h14" />}
            {name === 'spark' && <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />}
            {name === 'calendar' && <><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h.1M12 14h.1M16 14h.1M8 17.5h.1M12 17.5h.1" /></>}
            {name === 'trash' && <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>}
            {name === 'eye' && <><path d="M2.8 12s3.4-5 9.2-5 9.2 5 9.2 5-3.4 5-9.2 5-9.2-5-9.2-5" /><circle cx="12" cy="12" r="2.5" /></>}
        </svg>
    );
};
