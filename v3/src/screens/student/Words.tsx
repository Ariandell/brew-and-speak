import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useAppState } from '../../app/AppState';
import { studentTabForRoute, type StudentTab } from '../../app/routes';
import { BottomNav } from '../../ui/BottomNav';
import { Icon } from '../../ui/Icon';
import { Button, Card, EmptyState, inputClass, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';

export const Dictionary = () => {
    const { state, route, navigate } = useAppState();
    const [query, setQuery] = useState('');
    const accessibleLessons = useMemo(() => new Set(state.lessons.filter(lesson => lesson.courseId === state.currentUser.courseId && lesson.status !== 'locked').map(lesson => lesson.id)), [state.currentUser.courseId, state.lessons]);
    const availableCards = useMemo(() => state.cards.filter(card => accessibleLessons.has(card.lessonId)), [accessibleLessons, state.cards]);
    const cards = useMemo(() => availableCards.filter(card => `${card.front} ${card.back}`.toLowerCase().includes(query.toLowerCase())), [availableCards, query]);
    const nav = (tab: StudentTab) => navigate({ name: tab });
    return (
        <ProductPage nav={<BottomNav active={studentTabForRoute(route)} onSelect={nav} />}>
            <PageHeader eyebrow="Твій словник" title="Слова." description={`${availableCards.length} карток · ${availableCards.filter(card => card.due).length} чекають повторення`} />
            <div className="relative mt-5"><Icon name="search" className="absolute left-3.5 top-3.5 h-5 w-5 text-text-faint" /><input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="Знайти слово або переклад" className={`${inputClass} pl-11`} /></div>
            <Button className="mt-3 w-full" icon="cards" onClick={() => navigate({ name: 'cards' })}>Почати повторення</Button>
            <div className="mt-4 space-y-2">
                {cards.map(card => <Card key={card.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><strong className="block text-[16px] font-black">{card.front}</strong><span className="text-[12px] font-semibold text-text-soft">{card.back}</span><p className="mt-1 truncate text-[10px] font-semibold italic text-text-faint">{card.example}</p></div><StatusPill tone={card.state === 'learned' ? 'green' : card.state === 'learning' ? 'blue' : 'gray'}>{card.state === 'learned' ? 'Вивчено' : card.state === 'learning' ? 'Вчу' : 'Нове'}</StatusPill></Card>)}
            </div>
            {!cards.length && <EmptyState icon="search" title="Нічого не знайдено" copy="Спробуй інше слово або переклад." />}
        </ProductPage>
    );
};

export const Flashcards = () => {
    const { state, reviewCard, back } = useAppState();
    const initial = useMemo(() => { const lessons = new Set(state.lessons.filter(lesson => lesson.courseId === state.currentUser.courseId && lesson.status !== 'locked').map(lesson => lesson.id)); return state.cards.filter(card => lessons.has(card.lessonId) && card.due).sort((a, b) => Number(a.state !== 'new') - Number(b.state !== 'new') || (a.nextReviewAt ?? '').localeCompare(b.nextReviewAt ?? '')).slice(0, 20).map(card => card.id); }, [state.cards, state.currentUser.courseId, state.lessons]);
    const [queue, setQueue] = useState(initial);
    const [revealed, setRevealed] = useState(false);
    const [reviewed, setReviewed] = useState(0);
    const [offset, setOffset] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const startX = useRef<number | null>(null);
    const activePointer = useRef<number | null>(null);
    const offsetRef = useRef(0);
    const exitTimer = useRef<number | null>(null);
    const committing = useRef(false);
    const card = state.cards.find(item => item.id === queue[0]);
    useEffect(() => () => { if (exitTimer.current !== null) window.clearTimeout(exitTimer.current); }, []);
    const decide = (correct: boolean) => {
        if (!card) return;
        reviewCard(card.id, correct);
        setQueue(current => correct ? current.slice(1) : [...current.slice(1), current[0]]);
        setReviewed(value => value + 1);
        setRevealed(false);
    };
    const commitSwipe = (correct: boolean) => {
        if (!revealed || committing.current) return;
        committing.current = true;
        const target = (correct ? 1 : -1) * (window.innerWidth + 180);
        offsetRef.current = target;
        setOffset(target);
        setLeaving(true);
        exitTimer.current = window.setTimeout(() => {
            decide(correct);
            offsetRef.current = 0;
            setOffset(0);
            setLeaving(false);
            committing.current = false;
        }, 180);
    };
    const beginSwipe = (event: PointerEvent<HTMLDivElement>) => {
        if (!revealed || leaving || !event.isPrimary || event.button !== 0 || activePointer.current !== null) return;
        activePointer.current = event.pointerId;
        startX.current = event.clientX;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const moveSwipe = (event: PointerEvent<HTMLDivElement>) => {
        if (activePointer.current !== event.pointerId || startX.current === null || !revealed || leaving) return;
        const next = Math.max(-170, Math.min(170, event.clientX - startX.current));
        offsetRef.current = next;
        setOffset(next);
    };
    const finishSwipe = (event: PointerEvent<HTMLDivElement>) => {
        if (activePointer.current !== event.pointerId || startX.current === null) return;
        activePointer.current = null;
        const distance = offsetRef.current;
        startX.current = null;
        setDragging(false);
        if (Math.abs(distance) >= 76) commitSwipe(distance > 0);
        else { offsetRef.current = 0; setOffset(0); }
    };
    const cancelSwipe = (event: PointerEvent<HTMLDivElement>) => {
        if (activePointer.current !== event.pointerId) return;
        activePointer.current = null;
        startX.current = null;
        setDragging(false);
        if (committing.current) return;
        offsetRef.current = 0;
        setOffset(0);
    };
    const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!revealed && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setRevealed(true);
        } else if (revealed && event.key === 'ArrowLeft') {
            event.preventDefault();
            commitSwipe(false);
        } else if (revealed && event.key === 'ArrowRight') {
            event.preventDefault();
            commitSwipe(true);
        }
    };
    const confidence = Math.min(1, Math.abs(offset) / 100);
    return (
        <ProductPage>
            <PageHeader eyebrow="Повторення" title={card ? `${reviewed + 1} / ${Math.max(reviewed + queue.length, 1)}` : 'Готово.'} description={card ? 'Торкнись, щоб відкрити. Потім зроби свайп.' : `Повторено відповідей: ${reviewed}`} onBack={() => back({ name: 'dictionary' })} />
            {card ? (
                <>
                    <div className="relative mt-8">
                    <div aria-hidden className="glass-panel absolute inset-x-4 bottom-[-12px] top-3 rotate-[1.5deg] rounded-[24px] border border-white/65 bg-surface/75 shadow-card" />
                    <div aria-hidden className="glass-panel absolute inset-x-2 bottom-[-6px] top-1 -rotate-[0.8deg] rounded-[23px] border border-white/70 bg-surface/85 shadow-sm" />
                    <Card
                        role="button"
                        tabIndex={0}
                        aria-label={`Картка ${card.front}. ${revealed ? `${card.back}. Свайп ліворуч — ще не знаю, праворуч — знаю.` : 'Торкнись, щоб показати відповідь.'}`}
                        aria-describedby="flashcard-gesture-hint"
                        onClick={() => { if (!revealed && !leaving) setRevealed(true); }}
                        onKeyDown={handleKeyboard}
                        onPointerDown={beginSwipe}
                        onPointerMove={moveSwipe}
                        onPointerUp={finishSwipe}
                        onPointerCancel={cancelSwipe}
                        className={`relative flex min-h-[360px] select-none flex-col items-center justify-center overflow-hidden p-7 text-center ${revealed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                        style={{ touchAction: 'pan-y', transform: `translateX(${offset}px) rotate(${offset / 26}deg)`, transition: dragging ? 'none' : 'transform 180ms var(--ease-out)' }}
                    >
                        <span aria-hidden className="pointer-events-none absolute left-5 top-5 rounded-pill bg-alert px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white" style={{ opacity: offset < 0 ? confidence : 0 }}>Ще вчу</span>
                        <span aria-hidden className="pointer-events-none absolute right-5 top-5 rounded-pill bg-good px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white" style={{ opacity: offset > 0 ? confidence : 0 }}>Знаю</span>
                        <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-text-faint">English</p>
                        <h2 className="mt-4 text-[44px] font-black leading-none tracking-[-0.04em]">{card.front}</h2>
                        {revealed ? <div className="surface mt-7"><p className="text-[22px] font-black text-accent-deep">{card.back}</p><p className="mt-3 text-[13px] font-semibold italic text-text-soft">{card.example}</p></div> : <div className="mt-9 flex items-center gap-2 rounded-pill bg-accent-tint px-4 py-2 text-[11px] font-extrabold text-accent-deep"><Icon name="spark" className="h-4 w-4" />Торкнись, щоб відкрити</div>}
                    </Card>
                    </div>
                    <p id="flashcard-gesture-hint" className="mt-4 text-center font-mono text-[9px] font-black uppercase tracking-[0.13em] text-text-faint">{revealed ? '← ще не знаю · знаю →' : 'один дотик відкриває відповідь'}</p>
                </>
            ) : <EmptyState icon="check" title="На сьогодні все" copy="Наступні слова з’являться за розкладом повторення." action={<Button tone="secondary" onClick={() => back({ name: 'dictionary' })}>До словника</Button>} />}
        </ProductPage>
    );
};
