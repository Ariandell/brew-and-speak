import { useAppState } from '../../app/AppState';
import { MascotSpot } from '../../ui/MascotSpot';
import { Button, Card, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';

export const LessonResults = ({ lessonId }: { lessonId: number }) => {
    const { state, navigate } = useAppState();
    const result = state.results.find(item => item.studentId === state.currentUser.id && item.lessonId === lessonId);
    const lesson = state.lessons.find(item => item.id === lessonId);
    const hasHomework = lesson?.blocks.some(block => block.type === 'homework');
    if (!result || !lesson) return <ProductPage><PageHeader title="Результат недоступний" /><Button className="mt-6 w-full" onClick={() => navigate({ name: 'course' })}>До курсу</Button></ProductPage>;
    const percent = result.total ? Math.round(result.correct / result.total * 100) : 100;
    const message = result.total === 0 ? 'Матеріал завершено.' : percent === 100 ? 'Бездоганно.' : percent >= 70 ? 'Сильний результат.' : 'Є що повторити — і це нормально.';
    return (
        <ProductPage>
            <PageHeader eyebrow="Урок завершено" title={message} description={lesson.title} />
            {/* Facial expressions are projected onto the front of the sleeve.
                Keep result poses clear of that area: `celebrate` crosses a palm
                over the face, while `wave` reads as a greeting on a sad result. */}
            <MascotSpot pose={percent >= 70 ? 'present' : 'neutral'} mood={percent >= 70 ? 'happy' : 'sad'} />
            <Card className="mt-6 overflow-hidden p-6 text-center">
                <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-accent-tint ring-8 ring-accent/8">
                    <div><span className="block text-[52px] font-black leading-none text-accent">{result.score}</span><span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent-deep">із 10</span></div>
                </div>
                <div className="mt-6 grid grid-cols-3 divide-x divide-line">
                    <div><strong className="block text-[24px] font-black text-good">{result.correct}</strong><span className="text-[10px] font-bold text-text-faint">правильно</span></div>
                    <div><strong className="block text-[24px] font-black text-alert">{result.wrong}</strong><span className="text-[10px] font-bold text-text-faint">помилки</span></div>
                    <div><strong className="block text-[24px] font-black text-warm">{result.skipped}</strong><span className="text-[10px] font-bold text-text-faint">пропущено</span></div>
                </div>
                <div className="mt-5"><StatusPill tone={percent >= 70 ? 'green' : 'warm'}>{percent}% вправ</StatusPill></div>
            </Card>
            <div className="mt-4 grid gap-3">
                {hasHomework && <Button onClick={() => navigate({ name: 'homework', lessonId })}>Здати домашнє</Button>}
                <Button tone="secondary" onClick={() => navigate({ name: 'course' })}>Повернутися до курсу</Button>
            </div>
        </ProductPage>
    );
};
