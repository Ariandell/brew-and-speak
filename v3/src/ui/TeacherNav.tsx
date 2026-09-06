import type { TeacherTab } from '../app/routes';
import { Icon, type IconName } from './Icon';

const ITEMS: Array<{ id: TeacherTab; label: string; icon: IconName }> = [
    { id: 'teacher', label: 'Кабінет', icon: 'home' },
    { id: 'teacher-courses', label: 'Курси', icon: 'course' },
    { id: 'teacher-homework', label: 'Роботи', icon: 'homework' },
    { id: 'teacher-students', label: 'Учні', icon: 'students' },
    { id: 'teacher-chat', label: 'Чат', icon: 'chat' },
];

export const TeacherNav = ({ active, onSelect }: { active: TeacherTab; onSelect: (route: TeacherTab) => void }) => (
    <nav aria-label="Навігація викладачки" className="glass-panel absolute inset-x-3 bottom-3 z-40 grid h-[68px] grid-cols-5 rounded-[20px] border border-white/70 bg-surface/95 px-1 shadow-panel">
        {ITEMS.map(item => {
            const selected = item.id === active;
            return (
                <button key={item.id} type="button" aria-current={selected ? 'page' : undefined} onClick={() => onSelect(item.id)} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] text-[9px] font-extrabold transition-colors duration-quick ${selected ? 'text-accent' : 'text-text-faint'}`}>
                    {selected && <span aria-hidden className="absolute top-0 h-[3px] w-7 rounded-pill bg-accent" />}
                    <Icon name={item.icon} className="h-[21px] w-[21px]" />
                    <span className="max-w-full truncate">{item.label}</span>
                </button>
            );
        })}
    </nav>
);
