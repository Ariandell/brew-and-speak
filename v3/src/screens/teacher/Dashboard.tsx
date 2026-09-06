import { useAppState } from '../../app/AppState';
import { teacherTabForRoute, type TeacherTab } from '../../app/routes';
import { Icon, type IconName } from '../../ui/Icon';
import { Card, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';
import { TeacherNav } from '../../ui/TeacherNav';

export const TeacherDashboard = () => {
    const { state, route, navigate } = useAppState();
    const pending = state.homework.filter(item => item.status === 'pending').length;
    const unread = state.messages.filter(item => item.from === 'student' && !item.read).length;
    const completed = state.students.reduce((sum, student) => sum + student.completedLessons, 0);
    const nav = (tab: TeacherTab) => navigate({ name: tab });
    const shortcuts: Array<{ title: string; copy: string; icon: IconName; route: TeacherTab | 'teacher-broadcasts' | 'teacher-statistics'; badge?: number }> = [
        { title: 'Домашні', copy: 'Перевірити роботи', icon: 'homework', route: 'teacher-homework', badge: pending },
        { title: 'Учні', copy: 'Прогрес і доступ', icon: 'students', route: 'teacher-students' },
        { title: 'Курси', copy: 'Уроки та редактор', icon: 'course', route: 'teacher-courses' },
        { title: 'Розсилка', copy: 'Фото за розкладом', icon: 'broadcast', route: 'teacher-broadcasts' },
        { title: 'Статистика', copy: 'Зведення по курсах', icon: 'chart', route: 'teacher-statistics' },
    ];
    return (
        <ProductPage nav={<TeacherNav active={teacherTabForRoute(route)} onSelect={nav} />}>
            <PageHeader eyebrow="Teacher workspace" title="Кабінет." description="Усе, що потребує уваги, зібрано на одному екрані." />
            <div className="mt-5 grid grid-cols-3 gap-2">
                {[['Учні', state.students.length], ['Роботи', pending], ['Уроки', completed]].map(([label, value]) => <Card key={label} className="px-2 py-4 text-center"><strong className="block text-[25px] font-black text-accent">{value}</strong><span className="text-[9px] font-bold uppercase tracking-[0.08em] text-text-faint">{label}</span></Card>)}
            </div>
            {(pending > 0 || unread > 0) && <Card className="mt-3 flex items-center gap-3 border-warm/20 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-warm/14 text-warm"><Icon name="spark" /></span><div className="flex-1"><strong className="text-[14px] font-black">Потрібна увага</strong><p className="text-[11px] font-semibold text-text-soft">{pending} робіт · {unread} непрочитаних</p></div><StatusPill tone="warm">Сьогодні</StatusPill></Card>}
            <div className="mt-4 grid grid-cols-2 gap-3">
                {shortcuts.map(item => <button key={item.title} type="button" onClick={() => navigate({ name: item.route })} className="text-left"><Card className="relative min-h-[145px] p-4 transition active:scale-[0.985]"><span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-accent-tint text-accent"><Icon name={item.icon} /></span>{item.badge ? <span className="absolute right-4 top-4 flex h-6 min-w-6 items-center justify-center rounded-pill bg-alert px-1.5 text-[10px] font-black text-white">{item.badge}</span> : null}<strong className="mt-4 block text-[17px] font-black">{item.title}</strong><p className="mt-1 text-[11px] font-semibold text-text-faint">{item.copy}</p></Card></button>)}
            </div>
        </ProductPage>
    );
};
