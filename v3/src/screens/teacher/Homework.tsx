import { useRef, useState } from 'react';
import { HomeworkAttachment } from '../../ui/HomeworkAttachment';
import { AsyncFeedback, asyncErrorMessage, useMountedRef } from '../../ui/AsyncFeedback';
import { useAppState } from '../../app/AppState';
import { teacherTabForRoute, type TeacherTab } from '../../app/routes';
import { Icon } from '../../ui/Icon';
import { toPlainText } from '../../lib/plainText';
import { Button, Card, EmptyState, Field, inputClass, PageHeader, ProductPage, RichText, StatusPill } from '../../ui/ProductUI';
import { TeacherNav } from '../../ui/TeacherNav';

export const TeacherHomework = () => {
    const { state, route, navigate } = useAppState();
    const nav = (tab: TeacherTab) => navigate({ name: tab });
    const items = [...state.homework].filter(item => item.status !== 'draft').sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
    return (
        <ProductPage nav={<TeacherNav active={teacherTabForRoute(route)} onSelect={nav} />}>
            <PageHeader eyebrow="Перевірка" title="Домашні." description={`${items.filter(item => item.status === 'pending').length} робіт чекають оцінки`} />
            <div className="mt-5 space-y-3">{items.map(item => { const student = state.students.find(value => value.id === item.studentId); const lesson = state.lessons.find(value => value.id === item.lessonId); return <button key={item.id} type="button" onClick={() => navigate({ name: 'teacher-homework-review', submissionId: item.id })} className="block w-full text-left"><Card className="flex items-center gap-3 p-4 transition active:scale-[0.99]"><span className={`flex h-11 w-11 items-center justify-center rounded-[13px] ${item.status === 'pending' ? 'bg-warm/14 text-warm' : 'bg-good/14 text-good'}`}><Icon name="homework" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-[15px] font-black">{student?.name ?? `Учень ${item.studentId}`}</strong><StatusPill tone={item.status === 'pending' ? 'warm' : 'green'}>{item.status === 'pending' ? 'Чекає' : `${item.grade}/10`}</StatusPill></div><p className="mt-1 truncate text-[11px] font-semibold text-text-soft">{lesson?.title ?? 'Урок'}</p></div><Icon name="arrow" className="h-5 w-5 text-text-faint" /></Card></button>; })}</div>
            {!items.length && <EmptyState icon="check" title="Усе перевірено" copy="Нові роботи з’являться тут одразу після здачі." />}
        </ProductPage>
    );
};

export const HomeworkReview = ({ submissionId }: { submissionId: string }) => {
    const { state, gradeHomework, back } = useAppState();
    const item = state.homework.find(value => value.id === submissionId);
    const student = state.students.find(value => value.id === item?.studentId);
    const lesson = state.lessons.find(value => value.id === item?.lessonId);
    const [grade, setGrade] = useState(item?.grade ?? 8);
    const [comment, setComment] = useState(item?.comment ?? '');
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const mounted = useMountedRef();
    const saveInFlight = useRef(false);
    if (!item) return <ProductPage><PageHeader title="Роботу не знайдено" onBack={() => back({ name: 'teacher-homework' })} /></ProductPage>;
    const save = async () => {
        if (saveInFlight.current) return;
        saveInFlight.current = true; setSaving(true); setSaved(false); setError('');
        try {
            await gradeHomework(item.id, grade, comment);
            if (mounted.current) setSaved(true);
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося зберегти оцінку. Спробуйте ще раз.'));
        } finally {
            saveInFlight.current = false;
            if (mounted.current) setSaving(false);
        }
    };
    return (
        <ProductPage>
            <PageHeader eyebrow="Перевірка роботи" title={student?.name ?? 'Учень'} description={lesson?.title} onBack={() => back({ name: 'teacher-homework' })} />
            <Card className="mt-5 p-5"><p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-warm">Умова</p><RichText html={item.promptHtml} className="mt-3" /></Card>
            <Card className="mt-3 space-y-4 p-5"><Field label="Оцінка"><input disabled={saving} type="range" min={0} max={10} value={grade} onChange={event => { setGrade(Number(event.currentTarget.value)); setSaved(false); }} className="w-full accent-accent disabled:opacity-50" /><strong className="mt-1 block text-center text-[34px] font-black text-accent">{grade}/10</strong></Field><Field label="Коментар"><textarea disabled={saving} rows={5} value={comment} onChange={event => { setComment(event.currentTarget.value); setSaved(false); }} placeholder="Що вдалося і що повторити…" className={`${inputClass} resize-none`} /></Field><Button className="w-full" disabled={saving} onClick={() => void save()}>{saving ? 'Збереження…' : saved ? 'Оцінку збережено' : 'Зберегти оцінку'}</Button><AsyncFeedback error={error} success={saved ? 'Оцінка успішно збережена.' : ''} /></Card>
            <Card className="mt-3 p-5"><p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-accent-deep">Відповідь учня</p><p className="mt-3 whitespace-pre-wrap text-[14px] font-semibold leading-relaxed text-text-soft">{toPlainText(item.answer) || 'Текстової відповіді немає.'}</p>{item.assets?.map(asset => <HomeworkAttachment key={asset.assetId} assetId={asset.assetId} fileName={asset.fileName ?? asset.assetId} />)}{!item.assets?.length && item.fileName && <HomeworkAttachment assetId={item.assetId} fileName={item.fileName} />}</Card>
        </ProductPage>
    );
};
