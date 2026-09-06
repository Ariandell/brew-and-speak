import { useMemo } from 'react';
import { MascotSpot } from '../../ui/MascotSpot';
import { useAppState } from '../../app/AppState';
import { Button, Card, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';

const DAY = 86400000;
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const Schedule = () => {
    const { state, navigate, back } = useAppState();
    const lessons = state.lessons.filter(item => item.courseId === state.currentUser.courseId);
    const accessibleLessonIds = useMemo(() => new Set(lessons.filter(item => item.status !== 'locked').map(item => item.id)), [lessons]);
    const learnedCards = state.cards.filter(item => accessibleLessonIds.has(item.lessonId) && item.state === 'learned').length;
    const activity = useMemo(() => new Set(lessons.filter(item => item.completedAt).map(item => dayKey(new Date(item.completedAt!)))), [lessons]);
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(Date.now() - (6 - index) * DAY);
        return { date, active: activity.has(dayKey(date)) };
    });
    const next = lessons.find(item => item.status === 'available') ?? lessons.find(item => item.status === 'locked');
    return (
        <ProductPage>
            <PageHeader eyebrow="Ритм навчання" title="Розклад." description="Один погляд на тиждень, серію та найближчий крок." onBack={() => back({ name: 'home' })} />
            <MascotSpot pose="wait" />
            <Card className="mt-5 p-5">
                <div className="flex items-center justify-between"><h2 className="text-[18px] font-black">Останні 7 днів</h2><StatusPill tone="warm">{state.currentUser.streakDays} днів</StatusPill></div>
                <div className="mt-5 grid grid-cols-7 gap-2">{days.map(({ date, active }) => <div key={date.toISOString()} className="text-center"><span className="block text-[8px] font-black uppercase text-text-faint">{new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(date).slice(0, 2)}</span><span className={`mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-black ${active ? 'bg-accent text-white shadow-[0_6px_16px_rgb(var(--c-accent)/0.25)]' : 'border border-line bg-surface text-text-soft'}`}>{date.getDate()}</span></div>)}</div>
            </Card>
            <div className="mt-3 grid grid-cols-2 gap-3">
                <Card className="p-4"><strong className="block text-[30px] font-black text-accent">{lessons.filter(item => item.status === 'completed').length}</strong><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-faint">уроків пройдено</span></Card>
                <Card className="p-4"><strong className="block text-[30px] font-black text-good">{learnedCards}</strong><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-faint">слів вивчено</span></Card>
            </div>
            {next && <Card className="mt-3 p-5"><p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-accent-deep">Найближче</p><h2 className="mt-2 text-[20px] font-black">{next.title}</h2><p className="mt-1 text-[12px] font-semibold text-text-soft">Урок {next.order} · {next.durationMinutes} хвилин</p><Button className="mt-4 w-full" onClick={() => navigate({ name: 'lesson', lessonId: next.id })}>Відкрити урок</Button></Card>}
        </ProductPage>
    );
};
