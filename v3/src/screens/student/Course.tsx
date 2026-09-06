import { useMemo } from 'react';
import { useAppState } from '../../app/AppState';
import { studentTabForRoute, type StudentTab } from '../../app/routes';
import { BottomNav } from '../../ui/BottomNav';
import { Icon } from '../../ui/Icon';
import { Button, Card, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';
import { isLessonOpen, lessonAccessMessage } from '../../app/domain';

export const Course = () => {
    const { state, route, navigate } = useAppState();
    const course = state.courses.find(item => item.id === state.currentUser.courseId);
    const lessons = useMemo(() => state.lessons.filter(item => item.courseId === course?.id).sort((a, b) => a.order - b.order), [course?.id, state.lessons]);
    const completed = lessons.filter(item => item.status === 'completed').length;
    const nav = (tab: StudentTab) => navigate({ name: tab });

    return (
        <ProductPage nav={<BottomNav active={studentTabForRoute(route)} onSelect={nav} />}>
            <PageHeader eyebrow="Курс" title={course?.title ?? 'Курс не обрано'} description={course ? `${completed} із ${lessons.length} уроків завершено` : 'Оберіть напрямок навчання.'} />
            {course && (
                <div className="mt-5">
                    <div className="mb-5 h-2 overflow-hidden rounded-pill bg-accent-tint" role="progressbar" aria-label="Прогрес курсу" aria-valuenow={completed} aria-valuemax={lessons.length}>
                        <span className="block h-full rounded-pill bg-accent transition-all" style={{ width: `${lessons.length ? completed / lessons.length * 100 : 0}%` }} />
                    </div>
                    <div className="relative space-y-3 before:absolute before:bottom-5 before:left-[25px] before:top-5 before:w-px before:bg-line">
                        {lessons.map((lesson, index) => {
                            const locked = !isLessonOpen(lesson);
                            const completedLesson = lesson.status === 'completed';
                            return (
                                <button key={lesson.id} type="button" disabled={locked} onClick={() => navigate({ name: 'lesson', lessonId: lesson.id })} className="relative block w-full text-left disabled:cursor-not-allowed">
                                    <span className={`absolute left-[9px] top-5 z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border-4 border-base text-[10px] font-black ${completedLesson ? 'bg-good text-white' : locked ? 'bg-line text-text-faint' : 'bg-accent text-white'}`}>
                                        {completedLesson ? <Icon name="check" className="h-4 w-4" /> : index + 1}
                                    </span>
                                    <Card className={`ml-12 p-4 transition duration-quick active:scale-[0.99] ${locked ? 'opacity-62' : ''}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-faint">Урок {lesson.order} · {lesson.durationMinutes} хв</p>
                                                <h2 className="mt-1.5 text-[18px] font-black leading-tight">{lesson.title}</h2>
                                                <p className="mt-1 text-[12px] font-semibold text-text-soft">{lesson.subtitle}</p>
                                            </div>
                                            {locked ? <Icon name="lock" className="mt-1 h-5 w-5 shrink-0 text-text-faint" /> : completedLesson ? <StatusPill tone="green">{lesson.score}/10</StatusPill> : <StatusPill>Відкрито</StatusPill>}
                                        </div>
                                        {locked && <p className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-text-faint"><Icon name="clock" className="h-4 w-4" />{lessonAccessMessage(lesson)}</p>}
                                    </Card>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
            {!course && <Button className="mt-6 w-full" onClick={() => navigate({ name: 'course-select' })}>Обрати курс</Button>}
        </ProductPage>
    );
};
