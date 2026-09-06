import { useMemo, useState } from 'react';
import type { LessonBlock } from '../../api/contracts';
import { useAppState } from '../../app/AppState';
import { Button, Card, PageHeader, ProductPage, RichText, StatusPill } from '../../ui/ProductUI';
import { isLessonOpen, lessonAccessMessage } from '../../app/domain';
import { AuthenticatedAudio, AuthenticatedImage } from '../../ui/AuthenticatedAsset';

type Outcome = 'correct' | 'wrong';
const SCORED = new Set<LessonBlock['type']>(['quiz', 'fill_blank', 'true_false', 'word_order', 'match_pairs']);

const Feedback = ({ outcome }: { outcome: Outcome }) => (
    <p role="status" className={`mt-3 rounded-[12px] px-3 py-2 text-[12px] font-extrabold ${outcome === 'correct' ? 'bg-good/12 text-good' : 'bg-alert/12 text-alert'}`}>
        {outcome === 'correct' ? 'Правильно — рухаємось далі.' : 'Не зовсім. Перша відповідь уже зарахована.'}
    </p>
);

const ChoiceExercise = ({ options, answer, outcome, onChoose }: { options: string[]; answer: string; outcome?: Outcome; onChoose: (value: string) => void }) => (
    <div className="mt-4 grid gap-2">
        {options.map(option => (
            <button key={option} type="button" disabled={Boolean(outcome)} onClick={() => onChoose(option)} className={`min-h-11 rounded-[13px] border px-3 py-2 text-left text-[13px] font-bold transition ${outcome && option === answer ? 'border-good bg-good/10 text-good' : 'border-line bg-surface text-text'} disabled:opacity-75`}>
                {option}
            </button>
        ))}
        {outcome && <Feedback outcome={outcome} />}
    </div>
);

const WordOrderExercise = ({ block, outcome, onAnswer }: { block: Extract<LessonBlock, { type: 'word_order' }>; outcome?: Outcome; onAnswer: (answer: string[]) => void }) => {
    const [selected, setSelected] = useState<number[]>([]);
    const available = block.words.map((word, index) => ({ word, index })).filter(item => !selected.includes(item.index));
    return (
        <div className="mt-4">
            <div className="min-h-12 rounded-[13px] border border-dashed border-accent/35 bg-accent-tint/45 p-2">
                {selected.length ? selected.map((wordIndex, index) => <button key={`${wordIndex}-${index}`} type="button" disabled={Boolean(outcome)} onClick={() => setSelected(items => items.filter((_, itemIndex) => itemIndex !== index))} className="m-1 rounded-[9px] bg-surface px-2.5 py-1.5 text-[12px] font-bold shadow-sm">{block.words[wordIndex]}</button>) : <span className="px-2 text-[12px] font-semibold text-text-faint">Натискай слова у правильному порядку</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                {available.map(item => <button key={`${item.word}-${item.index}`} type="button" disabled={Boolean(outcome)} onClick={() => setSelected(items => [...items, item.index])} className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] font-bold">{item.word}</button>)}
            </div>
            {!outcome && <Button tone="secondary" className="mt-3 w-full" disabled={selected.length !== block.correctOrder.length} onClick={() => onAnswer(selected.map(index => block.words[index]))}>Перевірити порядок</Button>}
            {outcome && <Feedback outcome={outcome} />}
        </div>
    );
};

const MatchExercise = ({ block, outcome, onAnswer }: { block: Extract<LessonBlock, { type: 'match_pairs' }>; outcome?: Outcome; onAnswer: (answer: { left: string; right: string }[]) => void }) => {
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const shuffled = useMemo(() => [...block.pairs.map(pair => pair.right)].reverse(), [block.pairs]);
    return (
        <div className="mt-4 space-y-2">
            {block.pairs.map(pair => (
                <label key={pair.left} className="grid grid-cols-[1fr_1.2fr] items-center gap-2 text-[13px] font-bold">
                    <span>{pair.left}</span>
                    <select disabled={Boolean(outcome)} value={answers[pair.left] ?? ''} onChange={event => {
                        const value = event.currentTarget.value;
                        setAnswers(current => ({ ...current, [pair.left]: value }));
                    }} className="rounded-[11px] border border-line bg-surface px-3 py-2 text-text">
                        <option value="">Оберіть пару</option>
                        {shuffled.map(value => <option key={value}>{value}</option>)}
                    </select>
                </label>
            ))}
            {!outcome && <Button tone="secondary" className="mt-2 w-full" disabled={Object.keys(answers).length !== block.pairs.length} onClick={() => onAnswer(block.pairs.map(pair => ({ left: pair.left, right: answers[pair.left] ?? '' })))}>Перевірити пари</Button>}
            {outcome && <Feedback outcome={outcome} />}
        </div>
    );
};

export const Lesson = ({ lessonId, preview = false }: { lessonId: number; preview?: boolean }) => {
    const { state, navigate, back, answerLesson, finishLesson } = useAppState();
    const lesson = state.lessons.find(item => item.id === lessonId);
    const [answers, setAnswers] = useState<Record<number, Outcome>>(() => preview ? {} : state.lessonAttempts[state.currentUser.id]?.[lessonId] ?? {});
    const [requestError, setRequestError] = useState('');
    const [busyBlock, setBusyBlock] = useState<number | null>(null);
    const [finishing, setFinishing] = useState(false);
    if (!lesson) return <ProductPage><PageHeader title="Урок не знайдено" onBack={() => back({ name: 'course' })} /></ProductPage>;
    if (!preview && !isLessonOpen(lesson)) return <ProductPage><PageHeader eyebrow="Урок поки закритий" title={lesson.title} description={lessonAccessMessage(lesson) ?? undefined} onBack={() => back({ name: 'course' })} /><Card className="mt-6 p-6 text-center"><p className="text-[42px]">☕</p><p className="mt-3 text-[13px] font-semibold text-text-soft">Повернися у вказаний час — прогрес і таймер зберігаються після перезавантаження.</p></Card></ProductPage>;

    const answer = async (blockId: number, value: Parameters<typeof answerLesson>[2]) => {
        if (answers[blockId]) return;
        if (preview) {
            const block = lesson.blocks.find(item => item.id === blockId);
            const correct = block?.type === 'quiz' ? value === block.correctOption
                : block?.type === 'fill_blank' ? value === block.correctAnswer
                : block?.type === 'true_false' ? value === block.correct
                : block?.type === 'word_order' ? Array.isArray(value) && value.join('\u0000') === block.correctOrder.join('\u0000')
                : block?.type === 'match_pairs' ? Array.isArray(value) && block.pairs.every(pair => value.some(item => typeof item === 'object' && item !== null && 'left' in item && 'right' in item && item.left === pair.left && item.right === pair.right)) : false;
            setAnswers(current => ({ ...current, [blockId]: correct ? 'correct' : 'wrong' }));
            return;
        }
        setBusyBlock(blockId); setRequestError('');
        try {
            const outcome = await answerLesson(lessonId, blockId, value);
            setAnswers(current => ({ ...current, [blockId]: outcome }));
        } catch (error) { setRequestError(error instanceof Error ? error.message : 'Не вдалося зберегти відповідь.'); }
        finally { setBusyBlock(null); }
    };
    const scored = lesson.blocks.filter(block => SCORED.has(block.type));
    const finish = async () => {
        if (finishing || busyBlock !== null) return;
        setFinishing(true); setRequestError('');
        try { await finishLesson(lessonId); navigate({ name: 'lesson-results', lessonId }); }
        catch (error) { setRequestError(error instanceof Error ? error.message : 'Не вдалося завершити урок.'); setFinishing(false); }
    };

    return (
        <ProductPage>
            <PageHeader eyebrow={preview ? 'Передпоказ викладачки' : `Урок ${lesson.order}`} title={lesson.title} description={preview ? `Ревізія ${lesson.revision} · прогрес учня не змінюється` : `${lesson.durationMinutes} хвилин · результат враховує всі вправи`} onBack={() => back(preview ? { name: 'teacher-lessons', courseId: lesson.courseId } : { name: 'course' })} />
            <div className="mt-5 space-y-4">
                {lesson.blocks.map((block, index) => (
                    <Card key={block.id} className="p-5">
                        <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-faint">{String(index + 1).padStart(2, '0')}</span>{SCORED.has(block.type) && <StatusPill tone={answers[block.id] === 'correct' ? 'green' : answers[block.id] === 'wrong' ? 'red' : 'blue'}>{answers[block.id] ? 'Зараховано' : 'Вправа'}</StatusPill>}</div>
                        {block.type === 'text' && <RichText html={block.html} />}
                        {block.type === 'mascot_tip' && <div className="rounded-[16px] bg-accent-tint px-4 py-3"><p className="mb-1 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-accent-deep">Coffee note</p><RichText html={block.html} /></div>}
                        {block.type === 'photo' && <AuthenticatedImage assetId={block.assetId} alt={block.alt} />}
                        {block.type === 'audio' && <AuthenticatedAudio assetId={block.assetId} />}
                        {block.type === 'quiz' && <><h2 className="text-[17px] font-black">{block.question}</h2><ChoiceExercise options={block.options} answer={block.correctOption} outcome={answers[block.id]} onChoose={value => void answer(block.id, value)} /></>}
                        {block.type === 'fill_blank' && <><h2 className="text-[17px] font-black">{block.sentence.replace(/_+/, '_____')}</h2><ChoiceExercise options={block.options} answer={block.correctAnswer} outcome={answers[block.id]} onChoose={value => void answer(block.id, value)} /></>}
                        {block.type === 'true_false' && <><h2 className="text-[17px] font-black">{block.statement}</h2><ChoiceExercise options={['Вірно', 'Хибно']} answer={block.correct ? 'Вірно' : 'Хибно'} outcome={answers[block.id]} onChoose={value => void answer(block.id, value === 'Вірно')} /></>}
                        {block.type === 'word_order' && <><h2 className="text-[17px] font-black">Склади речення</h2><WordOrderExercise block={block} outcome={answers[block.id]} onAnswer={value => void answer(block.id, value)} /></>}
                        {block.type === 'match_pairs' && <><h2 className="text-[17px] font-black">Знайди пари</h2><MatchExercise block={block} outcome={answers[block.id]} onAnswer={value => void answer(block.id, value)} /></>}
                        {block.type === 'homework' && <><p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-warm">Домашнє завдання</p><RichText html={block.promptHtml} className="mt-2" /></>}
                        {block.type === 'unsupported' && <p className="rounded-[12px] bg-warm/12 p-3 text-[12px] font-bold text-[#91520e]">Цей старий блок не вдалося показати: {block.reason}</p>}
                    </Card>
                ))}
            </div>
            <Card className="mt-4 p-5">
                <div className="flex justify-between text-[12px] font-bold text-text-soft"><span>Виконано</span><span>{Object.keys(answers).length}/{scored.length}</span></div>
                <Button className="mt-4 w-full" disabled={finishing || busyBlock !== null} onClick={preview ? () => back({ name: 'teacher-lessons', courseId: lesson.courseId }) : () => void finish()}>{preview ? 'Завершити передпоказ' : finishing ? 'Завершення…' : 'Завершити урок'}</Button>
                {requestError && <p role="alert" className="mt-2 text-center text-[11px] font-bold text-alert">{requestError}</p>}
                {!preview && Object.keys(answers).length < scored.length && <p className="mt-2 text-center text-[10px] font-semibold text-text-faint">Невиконані вправи будуть позначені як пропущені.</p>}
            </Card>
        </ProductPage>
    );
};
