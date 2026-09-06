import { useMemo } from 'react';
import { MascotSpot } from '../../ui/MascotSpot';
import { useAppState } from '../../app/AppState';
import { studentTabForRoute, type StudentTab } from '../../app/routes';
import { BottomNav } from '../../ui/BottomNav';
import { Button, Card, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';
import { useAmbientMascot } from '../../ui/useAmbientMascot';

export const Profile = () => {
    const { mood: profileMood } = useAmbientMascot();
    const { state, route, navigate, resetDemo } = useAppState();
    const lessons = state.lessons.filter(item => item.courseId === state.currentUser.courseId);
    const completed = lessons.filter(item => item.status === 'completed');
    const accessibleLessonIds = useMemo(() => new Set(lessons.filter(item => item.status !== 'locked').map(item => item.id)), [lessons]);
    const availableCards = useMemo(() => state.cards.filter(item => accessibleLessonIds.has(item.lessonId)), [accessibleLessonIds, state.cards]);
    const learned = availableCards.filter(item => item.state === 'learned').length;
    const average = useMemo(() => {
        const scored = completed.filter(lesson => lesson.score !== null);
        return scored.length ? (scored.reduce((sum, lesson) => sum + lesson.score!, 0) / scored.length).toFixed(1) : '—';
    }, [completed]);
    const achievements = [
        ['Перший ковток', 'Завершити перший урок', completed.length >= 1], ['Три уроки', 'Завершити 3 уроки', completed.length >= 3], ['П’ять уроків', 'Завершити 5 уроків', completed.length >= 5], ['Десять уроків', 'Завершити 10 уроків', completed.length >= 10], ['Фініш курсу', 'Завершити весь курс', completed.length > 0 && completed.length === lessons.length],
        ['Перші слова', 'Вивчити 5 слів', learned >= 5], ['Словник росте', 'Вивчити 25 слів', learned >= 25], ['П’ятдесят слів', 'Вивчити 50 слів', learned >= 50], ['Сотня', 'Вивчити 100 слів', learned >= 100], ['Колекціонер', 'Відкрити 200 слів', availableCards.length >= 200],
        ['Три дні', 'Серія 3 дні', state.currentUser.streakDays >= 3], ['Тиждень разом', 'Серія 7 днів', state.currentUser.streakDays >= 7], ['Два тижні', 'Серія 14 днів', state.currentUser.streakDays >= 14], ['Місяць ритму', 'Серія 30 днів', state.currentUser.streakDays >= 30], ['Незламна серія', 'Серія 60 днів', state.currentUser.streakDays >= 60],
        ['Перша сесія', 'Повторити картки', availableCards.some(card => card.timesShown > 0)], ['Десять повторень', 'Показати картки 10 разів', availableCards.reduce((sum, card) => sum + card.timesShown, 0) >= 10], ['Без помилок', 'Отримати ідеальний урок', completed.some(item => item.score === 10)], ['Наполегливість', 'Повернутися до складного слова', availableCards.some(card => card.timesWrong >= 3)], ['Майстер карток', 'Вивчити всі доступні картки', availableCards.length > 0 && learned === availableCards.length],
    ] as const;
    const nav = (tab: StudentTab) => navigate({ name: tab });
    return (
        <ProductPage nav={<BottomNav active={studentTabForRoute(route)} onSelect={nav} />}>
            <PageHeader eyebrow="Твій прогрес" title={state.currentUser.name} description={state.currentUser.username ? `@${state.currentUser.username}` : 'Telegram student'} />
            <MascotSpot pose="neutral" mood={profileMood} className="-mt-2 h-[220px] w-[260px]" />
            <div className="mt-5 grid grid-cols-3 gap-2">
                {[['Серія', `${state.currentUser.streakDays} дн.`], ['Уроки', `${completed.length}`], ['Середній', `${average}`]].map(([label, value]) => <Card key={label} className="px-2 py-4 text-center"><strong className="block text-[22px] font-black text-accent">{value}</strong><span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-text-faint">{label}</span></Card>)}
            </div>
            <Card className="mt-3 p-5"><div className="flex items-center justify-between"><h2 className="text-[18px] font-black">Слова</h2><StatusPill tone="green">{learned} вивчено</StatusPill></div><div className="mt-4 h-2 overflow-hidden rounded-pill bg-accent-tint"><span className="block h-full rounded-pill bg-good" style={{ width: `${availableCards.length ? learned / availableCards.length * 100 : 0}%` }} /></div></Card>
            <h2 className="mt-7 text-[19px] font-black">Досягнення</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">{achievements.map(([title, copy, unlocked]) => <Card key={title} className={`p-4 ${unlocked ? '' : 'opacity-50'}`}><span className={`flex h-10 w-10 items-center justify-center rounded-[13px] text-[18px] ${unlocked ? 'bg-warm/16 text-warm' : 'bg-text/6 text-text-faint'}`}>{unlocked ? '✦' : '○'}</span><strong className="mt-3 block text-[14px] font-black">{title}</strong><p className="mt-1 text-[10px] font-semibold leading-relaxed text-text-faint">{copy}</p></Card>)}</div>
            <Button tone="secondary" className="mt-5 w-full" onClick={() => navigate({ name: 'course-select' })}>Змінити курс</Button>
            {import.meta.env.DEV && <Button tone="quiet" className="mt-2 w-full" onClick={resetDemo}>Скинути локальне демо</Button>}
        </ProductPage>
    );
};
