import { Icon, type IconName } from './Icon';
import type { StudentTab } from '../app/routes';

const ITEMS: Array<{ id: StudentTab; label: string; icon: IconName }> = [
    { id: 'home', label: 'Головна', icon: 'home' },
    { id: 'course', label: 'Курс', icon: 'course' },
    { id: 'dictionary', label: 'Слова', icon: 'cards' },
    { id: 'chat', label: 'Чат', icon: 'chat' },
    { id: 'profile', label: 'Профіль', icon: 'profile' },
];

interface Props {
    active: StudentTab;
    onSelect: (route: StudentTab) => void;
}

export const BottomNav = ({ active, onSelect }: Props) => (
    <nav
        aria-label="Основна навігація"
        className="glass-panel absolute inset-x-3 bottom-3 z-40 grid h-[68px] grid-cols-5 rounded-[20px] border border-white/70 bg-surface/95 px-1 shadow-[0_2px_5px_rgba(15,27,51,0.05),0_16px_36px_rgba(15,27,51,0.12)]"
    >
        {ITEMS.map(item => {
            const selected = item.id === active;
            return (
                <button
                    key={item.id}
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => onSelect(item.id)}
                    className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] text-[10px] font-extrabold transition-colors duration-quick ease-out ${
                        selected ? 'text-accent' : 'text-text-faint'
                    }`}
                >
                    {selected && <span aria-hidden className="absolute top-0 h-[3px] w-7 rounded-pill bg-accent" />}
                    <Icon name={item.icon} className="h-[21px] w-[21px]" />
                    <span className="truncate">{item.label}</span>
                </button>
            );
        })}
    </nav>
);
