import { useEffect, useMemo, useRef, useState } from 'react';
import { vocabularySchema, type LessonVocabulary } from '../../api/vocabularyContracts';
import { LessonVocabularyEditor } from './LessonVocabularyEditor';
import type { LessonBlock } from '../../api/contracts';
import { createLessonBlock, nextBlockId, validateLessonDraft } from '../../app/domain';
import { useAppState } from '../../app/AppState';
import { teacherTabForRoute, type TeacherTab } from '../../app/routes';
import { Icon } from '../../ui/Icon';
import { AsyncFeedback, asyncErrorMessage, useMountedRef } from '../../ui/AsyncFeedback';
import { Button, Card, EmptyState, Field, inputClass, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';
import { RichTextDraftEditor } from '../../ui/RichTextDraftEditor';
import { TeacherNav } from '../../ui/TeacherNav';
import { ChoiceEditor } from './ChoiceEditor';
import { WordOrderEditor } from './WordOrderEditor';

const blockNames: Record<LessonBlock['type'], string> = {
    text: 'Текст', audio: 'Аудіо', photo: 'Фото', mascot_tip: 'Підказка маскота', quiz: 'Тест',
    fill_blank: 'Пропущене слово', true_false: 'Вірно / хибно', word_order: 'Порядок слів',
    match_pairs: 'Знайди пару', homework: 'Домашнє завдання', unsupported: 'Старий блок',
};
const addableTypes = (Object.keys(blockNames) as LessonBlock['type'][]).filter(type => type !== 'unsupported');

const AssetField = ({ label, accept, assetId, onUploaded }: { label: string; accept: string; assetId: string; onUploaded: (assetId: string) => void }) => {
    const { uploadAsset } = useAppState();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const mounted = useMountedRef();
    return <Field label={label} hint={assetId ? `ID: ${assetId}` : 'до 20 МБ'}>
        <input type="file" accept={accept} disabled={busy} onChange={event => {
            const file = event.currentTarget.files?.[0]; if (!file) return;
            setBusy(true); setError('');
            void uploadAsset(file).then(uploadedId => {
                if (mounted.current) onUploaded(uploadedId);
            }).catch(reason => {
                if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося завантажити файл. Спробуйте ще раз.'));
            }).finally(() => {
                if (mounted.current) setBusy(false);
            });
        }} className="block w-full text-[11px] font-semibold text-text-soft file:mr-3 file:rounded-[10px] file:border-0 file:bg-accent-tint file:px-3 file:py-2 file:font-bold file:text-accent-deep" />
        {busy && <p className="mt-2 text-[10px] font-bold text-accent">Завантаження…</p>}
        {error && <p role="alert" className="mt-2 text-[10px] font-bold text-alert">{error}</p>}
    </Field>;
};

export const TeacherCourses = () => {
    const { state, route, navigate, createCourse, updateCourse, deleteCourse } = useAppState();
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const course = editing === 'new' ? null : state.courses.find(item => item.id === editing);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const mounted = useMountedRef();
    const actionInFlight = useRef(false);
    const nav = (tab: TeacherTab) => navigate({ name: tab });
    const begin = (id: number | 'new') => {
        const selected = id === 'new' ? null : state.courses.find(item => item.id === id);
        if (actionInFlight.current) return;
        setEditing(id); setTitle(selected?.title ?? ''); setDescription(selected?.description ?? ''); setNotice(''); setError('');
    };
    const save = async () => {
        if (actionInFlight.current) return;
        if (!title.trim()) { setError('Назва обов’язкова.'); setNotice(''); return; }
        actionInFlight.current = true; setBusy(true); setError(''); setNotice('');
        try {
            if (editing === 'new') await createCourse(title, description, '');
            else if (typeof editing === 'number') await updateCourse(editing, title, description, '');
            if (!mounted.current) return;
            setEditing(null); setNotice('Курс збережено.');
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося зберегти курс. Спробуйте ще раз.'));
        } finally {
            actionInFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const remove = async (courseId: number) => {
        if (actionInFlight.current) return;
        const lessons = state.lessons.filter(item => item.courseId === courseId).length;
        const students = state.students.filter(item => item.courseId === courseId).length;
        if (lessons || students) { setError(`Курс не видалено: ${lessons} уроків і ${students} учнів ще пов’язані з ним.`); setNotice(''); return; }
        actionInFlight.current = true; setBusy(true); setError(''); setNotice('');
        try {
            await deleteCourse(courseId);
            if (!mounted.current) return;
            setEditing(null); setNotice('Порожній курс видалено.');
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося видалити курс. Спробуйте ще раз.'));
        } finally {
            actionInFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    return <ProductPage nav={<TeacherNav active={teacherTabForRoute(route)} onSelect={nav} />}>
        <PageHeader eyebrow="Навчальний контент" title="Курси." description="Структура курсів без прихованого каскадного видалення." action={<button type="button" disabled={busy} onClick={() => begin('new')} aria-label="Створити курс" className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent text-white disabled:opacity-50"><Icon name="plus" /></button>} />
        <div className="mt-4"><AsyncFeedback error={error} success={notice} /></div>
        {editing !== null && <Card className="mt-4 space-y-4 p-5"><Field label="Назва"><input disabled={busy} value={title} onChange={event => setTitle(event.currentTarget.value)} className={inputClass} /></Field><Field label="Опис"><textarea disabled={busy} rows={3} value={description} onChange={event => setDescription(event.currentTarget.value)} className={`${inputClass} resize-none`} /></Field><div className="grid grid-cols-2 gap-2"><Button tone="secondary" disabled={busy} onClick={() => setEditing(null)}>Скасувати</Button><Button disabled={busy} onClick={() => void save()}>{busy ? 'Збереження…' : 'Зберегти'}</Button></div>{course && <Button tone="danger" disabled={busy} className="w-full" icon="trash" onClick={() => void remove(course.id)}>{busy ? 'Видалення…' : 'Видалити порожній курс'}</Button>}</Card>}
        <div className="mt-5 space-y-3">{[...state.courses].sort((a, b) => a.order - b.order).map(item => { const count = state.lessons.filter(lesson => lesson.courseId === item.id).length; return <Card key={item.id} className="flex items-center gap-3 p-4"><button type="button" disabled={busy} onClick={() => navigate({ name: 'teacher-lessons', courseId: item.id })} className="flex min-w-0 flex-1 items-center gap-4 text-left disabled:opacity-60"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-accent-tint text-accent"><Icon name="course" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2">{item.level && <StatusPill>{item.level}</StatusPill>}<span className="font-mono text-[9px] text-text-faint">{count} уроків</span></span><strong className="mt-2 block truncate text-[18px] font-black">{item.title}</strong><span className="mt-1 block truncate text-[11px] font-semibold text-text-soft">{item.description}</span></span></button><button type="button" disabled={busy} onClick={() => begin(item.id)} aria-label={`Редагувати курс ${item.title}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-line bg-surface text-accent disabled:opacity-50"><Icon name="edit" /></button></Card>; })}</div>
    </ProductPage>;
};

export const TeacherLessons = ({ courseId }: { courseId: number }) => {
    const { state, navigate, back, createLesson, deleteLesson } = useAppState();
    const course = state.courses.find(item => item.id === courseId);
    const lessons = state.lessons.filter(item => item.courseId === courseId).sort((a, b) => a.order - b.order);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const mounted = useMountedRef();
    const actionInFlight = useRef(false);
    const add = async () => {
        if (actionInFlight.current) return;
        actionInFlight.current = true; setCreating(true); setError(''); setNotice('');
        try {
            const lessonId = await createLesson(courseId);
            if (mounted.current) navigate({ name: 'teacher-editor', lessonId });
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося створити урок. Спробуйте ще раз.'));
        } finally {
            actionInFlight.current = false;
            if (mounted.current) setCreating(false);
        }
    };
    const removeLesson = async (lessonId: number) => {
        if (actionInFlight.current) return;
        actionInFlight.current = true; setDeletingId(lessonId); setError(''); setNotice('');
        try {
            await deleteLesson(lessonId);
            if (mounted.current) setNotice('Чернетку уроку видалено.');
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося видалити урок. Спробуйте ще раз.'));
        } finally {
            actionInFlight.current = false;
            if (mounted.current) setDeletingId(null);
        }
    };
    return <ProductPage>
        <PageHeader eyebrow="Курс" title={course?.title ?? 'Не знайдено'} description={`${lessons.length} уроків`} onBack={() => back({ name: 'teacher-courses' })} action={course ? <button type="button" disabled={creating || deletingId !== null} onClick={() => void add()} aria-label="Створити урок" className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent text-white disabled:opacity-50"><Icon name="plus" /></button> : null} />
        <div className="mt-4"><AsyncFeedback error={error} success={notice} /></div>
        <div className="mt-5 space-y-3">{lessons.map(lesson => {
            const linked = lesson.status === 'completed' || state.homework.some(item => item.lessonId === lesson.id) || state.results.some(item => item.lessonId === lesson.id);
            return <Card key={lesson.id} className="p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent-tint text-[12px] font-black text-accent">{lesson.order}</span><div className="min-w-0 flex-1"><strong className="block truncate text-[16px] font-black">{lesson.title}</strong><span className="text-[10px] font-semibold text-text-faint">{lesson.blocks.length} блоків · ревізія {lesson.revision}</span></div><button type="button" disabled={deletingId !== null} aria-label={`Передпоказ ${lesson.title}`} onClick={() => navigate({ name: 'teacher-preview', lessonId: lesson.id })} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-line bg-surface text-text-soft disabled:opacity-50"><Icon name="eye" /></button><button type="button" disabled={deletingId !== null} aria-label={`Редагувати ${lesson.title}`} onClick={() => navigate({ name: 'teacher-editor', lessonId: lesson.id })} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-line bg-surface text-accent disabled:opacity-50"><Icon name="edit" /></button></div>{!linked && <button type="button" disabled={deletingId !== null} onClick={() => void removeLesson(lesson.id)} className="mt-3 flex items-center gap-1 text-[10px] font-black text-alert disabled:opacity-50"><Icon name="trash" className="h-4 w-4" />{deletingId === lesson.id ? 'Видалення…' : 'Видалити чернетку'}</button>}{linked && <p className="mt-3 text-[9px] font-bold text-text-faint">Видалення вимкнено: з уроком уже пов’язані дані учнів.</p>}</Card>;
        })}</div>
        {!lessons.length && <EmptyState icon="course" title="Уроків поки немає" copy="Створи перший урок — він одразу відкриється в конструкторі." action={<Button icon="plus" disabled={creating} onClick={() => void add()}>{creating ? 'Створення…' : 'Створити урок'}</Button>} />}
    </ProductPage>;
};

const BlockEditor = ({ block, update }: { block: LessonBlock; update: (patch: Record<string, unknown>) => void }) => {
    switch (block.type) {
        case 'text': return <RichTextDraftEditor value={block.html} onChange={html => update({ html })} placeholder="Текст уроку…" />;
        case 'mascot_tip': return <div className="space-y-3"><Field label="Настрій"><select value={block.mood} onChange={event => update({ mood: event.currentTarget.value })} className={inputClass}>{['neutral', 'happy', 'perfect', 'sad', 'surprised'].map(value => <option key={value}>{value}</option>)}</select></Field><RichTextDraftEditor value={block.html} onChange={html => update({ html })} placeholder="Коротка підказка…" /></div>;
        case 'audio': return <div className="space-y-3"><AssetField label="Аудіофайл" accept="audio/*" assetId={block.assetId} onUploaded={assetId => update({ assetId })} /><Field label="Підпис"><input value={block.title ?? ''} onChange={event => update({ title: event.currentTarget.value })} className={inputClass} /></Field></div>;
        case 'photo': return <div className="space-y-3"><AssetField label="Зображення" accept="image/*" assetId={block.assetId} onUploaded={assetId => update({ assetId })} /><Field label="Опис зображення"><input value={block.alt} onChange={event => update({ alt: event.currentTarget.value })} className={inputClass} /></Field></div>;
        case 'quiz': return <div className="space-y-3"><Field label="Питання"><input value={block.question} onChange={event => update({ question: event.currentTarget.value })} className={inputClass} /></Field><ChoiceEditor options={block.options} correct={block.correctOption} onChange={(options, correctOption) => update({ options, correctOption })} /></div>;
        case 'fill_blank': return <div className="space-y-3"><Field label="Речення" hint="пропуск познач ___"><input value={block.sentence} onChange={event => update({ sentence: event.currentTarget.value })} className={inputClass} /></Field><ChoiceEditor options={block.options} correct={block.correctAnswer} onChange={(options, correctAnswer) => update({ options, correctAnswer })} /></div>;
        case 'true_false': return <div className="space-y-3"><Field label="Твердження"><textarea rows={3} value={block.statement} onChange={event => update({ statement: event.currentTarget.value })} className={`${inputClass} resize-y`} /></Field><Field label="Правильна відповідь"><select value={String(block.correct)} onChange={event => update({ correct: event.currentTarget.value === 'true' })} className={inputClass}><option value="true">Вірно</option><option value="false">Хибно</option></select></Field></div>;
        case 'word_order': return <WordOrderEditor correctOrder={block.correctOrder} update={update} />;
        case 'match_pairs': return <div className="space-y-3">{block.pairs.map((pair, index) => <div key={index} className="flex gap-2">{(['left', 'right'] as const).map(side => <input key={side} aria-label={`${side === 'left' ? 'Слово' : 'Відповідник'} ${index + 1}`} placeholder={side === 'left' ? 'Слово' : 'Відповідник'} value={pair[side]} className={`${inputClass} min-w-0 flex-1`} onChange={event => update({ pairs: block.pairs.map((item, i) => i === index ? { ...item, [side]: event.target.value } : item) })} />)}<button type="button" aria-label={`Видалити пару ${index + 1}`} onClick={() => update({ pairs: block.pairs.filter((_, i) => i !== index) })} className="text-alert">×</button></div>)}<Button tone="secondary" onClick={() => update({ pairs: [...block.pairs, { left: '', right: '' }] })}>+ Додати пару</Button></div>;
        case 'homework': return <RichTextDraftEditor value={block.promptHtml} onChange={promptHtml => update({ promptHtml })} placeholder="Умова домашнього завдання…" />;
        case 'unsupported': return <p className="rounded-[12px] bg-warm/12 p-3 text-[11px] font-bold text-[#91520e]">{block.reason}. Блок показано, а не приховано: заміни його підтримуваним типом, коли зміст буде відомий.</p>;
    }
};

export const LessonEditor = ({ lessonId }: { lessonId: number }) => {
    const { state, saveLesson, loadLessonVocabulary, saveLessonVocabulary, navigate, back } = useAppState();
    const [vocabulary, setVocabulary] = useState<LessonVocabulary | null>(null);
    const [vocabularyError, setVocabularyError] = useState('');
    const loadVocabulary = useRef(loadLessonVocabulary);
    useEffect(() => {
        let active = true;
        void loadVocabulary.current(lessonId).then(value => { if (active) setVocabulary(value); })
            .catch(reason => { if (active) setVocabularyError(asyncErrorMessage(reason, 'Не вдалося завантажити словник. Відкрийте урок повторно.')); });
        return () => { active = false; };
    }, [lessonId]);
    const lesson = state.lessons.find(item => item.id === lessonId);
    const [title, setTitle] = useState(lesson?.title ?? '');
    const [blocks, setBlocks] = useState<LessonBlock[]>(lesson?.blocks ?? []);
    const [saved, setSaved] = useState(false);
    const [showIssues, setShowIssues] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const mounted = useMountedRef();
    const saveInFlight = useRef(false);
    const issues = useMemo(() => validateLessonDraft(title, blocks), [blocks, title]);
    if (!lesson) return <ProductPage><PageHeader title="Урок не знайдено" onBack={() => back({ name: 'teacher-courses' })} /></ProductPage>;
    const update = (id: number, patch: Record<string, unknown>) => setBlocks(current => current.map(block => block.id === id ? ({ ...block, ...patch } as LessonBlock) : block));
    const reorder = (index: number, direction: -1 | 1) => setBlocks(current => { const target = index + direction; if (target < 0 || target >= current.length) return current; const copy = [...current]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy.map((block, order) => ({ ...block, order })); });
    const remove = (id: number) => setBlocks(current => current.filter(block => block.id !== id).map((block, order) => ({ ...block, order })));
    const add = (type: LessonBlock['type']) => { setSaved(false); setBlocks(current => [...current, createLessonBlock(type, nextBlockId(current), current.length)]); };
    const save = async () => {
        setShowIssues(true);
        if (issues.length || saveInFlight.current || !vocabulary) return false;
        if (!vocabularySchema.safeParse(vocabulary).success) { setError('Заповніть слово та переклад у кожній картці словника.'); return false; }
        saveInFlight.current = true; setSaving(true); setError(''); setSaved(false);
        try {
            await saveLesson(lessonId, title, blocks);
            if (vocabulary) {
                const updated = await saveLessonVocabulary(lessonId, vocabulary);
                if (mounted.current) setVocabulary(updated);
            }
            if (mounted.current) setSaved(true);
            return true;
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося зберегти урок. Зміни залишилися на екрані — спробуйте ще раз.'));
            return false;
        } finally {
            saveInFlight.current = false;
            if (mounted.current) setSaving(false);
        }
    };
    return <ProductPage>
        <PageHeader eyebrow="Конструктор уроку" title="Редактор." description="Додавайте блоки, а слова для карток — у словник уроку." onBack={() => back({ name: 'teacher-lessons', courseId: lesson.courseId })} action={<button type="button" disabled={saving || !vocabulary} onClick={() => void save().then(ok => { if (ok) navigate({ name: 'teacher-preview', lessonId }); })} aria-label="Передпоказ уроку" title="Зберегти й переглянути" className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-line bg-surface text-accent"><Icon name="eye" /></button>} />
        <fieldset disabled={saving}>
        <div className="sticky top-0 z-20 mt-3 flex gap-2 rounded-xl bg-white p-2"><Button disabled={saving || !vocabulary} onClick={() => void save()}>Зберегти урок</Button><Button tone="secondary" onClick={() => document.getElementById('lesson-vocabulary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>📖 Словник / картки</Button></div>
        <Card className="mt-5 p-5"><Field label="Назва уроку"><input value={title} onChange={event => { setTitle(event.currentTarget.value); setSaved(false); }} className={inputClass} /></Field></Card>
        {showIssues && issues.length > 0 && <Card className="mt-3 border-alert/20 bg-alert/8 p-4"><strong className="text-[12px] font-black text-alert">Чернетка ще не готова</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] font-semibold text-alert">{issues.map((issue, index) => <li key={`${issue.blockId}-${index}`}>{issue.blockId ? `Блок ${blocks.findIndex(block => block.id === issue.blockId) + 1}: ` : ''}{issue.message}</li>)}</ul></Card>}
        <div className="mt-3"><AsyncFeedback error={error} /></div>
        <div className="mt-4 space-y-3">{blocks.map((block, index) => <Card key={block.id} className="p-4"><div className="mb-4 flex items-center gap-2"><span className="font-mono text-[9px] font-bold text-text-faint">{String(index + 1).padStart(2, '0')}</span><StatusPill tone={block.type === 'unsupported' ? 'warm' : 'blue'}>{blockNames[block.type]}</StatusPill><div className="ml-auto flex gap-1"><button type="button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label="Перемістити блок вгору" className="h-8 w-8 rounded-[9px] border border-line bg-surface text-[13px] font-black disabled:opacity-30">↑</button><button type="button" disabled={index === blocks.length - 1} onClick={() => reorder(index, 1)} aria-label="Перемістити блок вниз" className="h-8 w-8 rounded-[9px] border border-line bg-surface text-[13px] font-black disabled:opacity-30">↓</button><button type="button" onClick={() => remove(block.id)} aria-label="Видалити блок" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-alert"><Icon name="trash" className="h-4 w-4" /></button></div></div><BlockEditor block={block} update={patch => { update(block.id, patch); setSaved(false); }} /></Card>)}</div>
        <Card className="mt-3 p-4"><h2 className="mb-3 font-bold">Додати блок</h2><div className="grid grid-cols-2 gap-2">{addableTypes.map(value => <Button key={value} tone="secondary" onClick={() => add(value)}>+ {blockNames[value]}</Button>)}</div></Card>
        {vocabulary ? <LessonVocabularyEditor lessonId={lessonId} value={vocabulary} onChange={value => { setVocabulary(value); setSaved(false); }} /> : <p id="lesson-vocabulary" role={vocabularyError ? 'alert' : 'status'} className="mt-4 text-sm">{vocabularyError || 'Завантаження словника…'}</p>}
        <Button className="mt-3 w-full" disabled={saving || !vocabulary} onClick={() => void save()}>{saving ? 'Збереження…' : saved ? 'Урок і словник збережено' : 'Зберегти урок і словник'}</Button>
        </fieldset>
    </ProductPage>;
};
