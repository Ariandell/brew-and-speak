import { useRef, useState } from 'react';
import { useAppState } from '../../app/AppState';
import { MascotSpot } from '../../ui/MascotSpot';
import { Button, Card, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';
import { AsyncFeedback, asyncErrorMessage, useMountedRef } from '../../ui/AsyncFeedback';

export const CourseSelect = () => {
    const { state, enroll, navigate, back } = useAppState();
    const [busyCourseId, setBusyCourseId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const mounted = useMountedRef();
    const choose = async (courseId: number) => {
        if (lock.current) return;
        lock.current = true;
        setBusyCourseId(courseId); setError('');
        try {
            await enroll(courseId);
            if (mounted.current) navigate({ name: 'home' });
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося обрати курс. Спробуй ще раз.'));
        } finally {
            lock.current = false;
            if (mounted.current) setBusyCourseId(null);
        }
    };
    return (
        <ProductPage>
            <PageHeader eyebrow="Твій маршрут" title="Обери курс." description="Це можна змінити пізніше у профілі." onBack={() => back({ name: 'welcome' })} />
            <MascotSpot pose="present" />
            <div className="mt-3"><AsyncFeedback error={error} /></div>
            <div className="mt-5 space-y-3">
                {state.courses.map(course => {
                    const active = state.currentUser.courseId === course.id;
                    return (
                        <Card key={course.id} className={`p-5 ${active ? 'ring-2 ring-accent/25' : ''}`}>
                            <div className="flex items-center justify-between gap-3">
                                <StatusPill tone={active ? 'green' : 'blue'}>{active ? 'Обрано' : course.level || 'Курс'}</StatusPill>
                                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-faint">{course.lessonCount ?? state.lessons.filter(lesson => lesson.courseId === course.id).length} уроків</span>
                            </div>
                            <h2 className="mt-4 text-[24px] font-black leading-tight">{course.title}</h2>
                            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-text-soft">{course.description}</p>
                            <Button disabled={busyCourseId !== null} aria-label={`${active ? 'Продовжити' : 'Обрати'} курс ${course.title}`} className="mt-5 w-full" tone={active ? 'secondary' : 'primary'} onClick={() => void choose(course.id)}>
                                {busyCourseId === course.id ? 'Зберігаємо…' : active ? 'Продовжити курс' : 'Обрати курс'}
                            </Button>
                        </Card>
                    );
                })}
            </div>
        </ProductPage>
    );
};
