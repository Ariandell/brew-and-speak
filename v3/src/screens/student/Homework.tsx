import { useState } from 'react';
import { HomeworkAttachment } from '../../ui/HomeworkAttachment';
import { useAppState } from '../../app/AppState';
import { toPlainText } from '../../lib/plainText';
import { Button, Card, Field, inputClass, PageHeader, ProductPage, RichText, StatusPill } from '../../ui/ProductUI';

export const Homework = ({ lessonId }: { lessonId: number }) => {
    const { state, submitHomework, back } = useAppState();
    const lesson = state.lessons.find(item => item.id === lessonId);
    const block = lesson?.blocks.find(item => item.type === 'homework');
    const submission = state.homework.find(item => item.studentId === state.currentUser.id && item.lessonId === lessonId);
    const [answer, setAnswer] = useState(toPlainText(submission?.answer ?? ''));
    const [fileName, setFileName] = useState<string | null>(submission?.fileName ?? null);
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [sent, setSent] = useState(false);
    const [fileError, setFileError] = useState('');
    const promptHtml = block?.type === 'homework' ? block.promptHtml : submission?.promptHtml;

    if (!lesson || !promptHtml) return <ProductPage><PageHeader title="Домашнього немає" onBack={() => back({ name: 'course' })} /></ProductPage>;
    const wasGraded = submission?.status === 'graded';
    const submit = async () => {
        if (busy) return;
        setBusy(true); setSaveError(''); setSent(false);
        try { await submitHomework(lessonId, answer, file); setSent(true); }
        catch (error) { setSaveError(error instanceof Error ? error.message : 'Не вдалося зберегти роботу.'); }
        finally { setBusy(false); }
    };

    return (
        <ProductPage>
            <PageHeader eyebrow="Домашнє завдання" title={lesson.title} description="Умова завжди лишається перед очима." onBack={() => back({ name: 'course' })} />
            <Card className="mt-5 p-5">
                <div className="flex items-center justify-between"><p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-warm">Що потрібно зробити</p>{submission && <StatusPill tone={submission.status === 'graded' ? 'green' : 'blue'}>{submission.status === 'graded' ? 'Оцінено' : 'На перевірці'}</StatusPill>}</div>
                <RichText html={promptHtml} className="mt-3" />
            </Card>
            {submission?.status === 'graded' && (
                <Card className="mt-4 border-good/20 p-5">
                    <p className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-good">Відгук викладачки</p>
                    <strong className="mt-3 block text-[38px] font-black text-good">{submission.grade}/10</strong>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] font-semibold leading-relaxed text-text-soft">{toPlainText(submission.comment ?? '') || 'Без додаткового коментаря.'}</p>
                    <p className="mt-3 text-[11px] font-bold leading-relaxed text-text-soft">Можна виправити відповідь нижче й надіслати роботу повторно.</p>
                </Card>
            )}
            <Card className="mt-4 space-y-4 p-5">
                <Field label={wasGraded ? 'Твоя відповідь — можна виправити' : 'Відповідь'}>
                    <textarea value={answer} disabled={busy} onChange={event => setAnswer(toPlainText(event.currentTarget.value))} rows={7} placeholder="Напиши відповідь тут…" className={`${inputClass} resize-none`} />
                </Field>
                <Field label="Файл" hint="до 20 МБ">
                    <input type="file" disabled={busy} accept="image/png,image/jpeg,image/webp,image/gif,audio/*,video/*,.pdf,.doc,.docx" onChange={event => {
                        const picked = event.currentTarget.files?.[0];
                        setFileError(''); setFile(null); setFileName(null);
                        if (!picked) return;
                        if (!picked.size || picked.size > 20 * 1024 * 1024) { setFileError('Файл має бути непорожнім і не більшим за 20 МБ.'); event.currentTarget.value = ''; return; }
                        const allowed = /^(image\/(png|jpeg|webp|gif|avif)$|(audio|video)\/)/.test(picked.type) || /\.(pdf|docx?)$/i.test(picked.name);
                        if (!allowed) { setFileError('Цей тип файлу не підтримується.'); event.currentTarget.value = ''; return; }
                        setFile(picked); setFileName(picked.name);
                    }} className="block w-full text-[12px] font-semibold text-text-soft file:mr-3 file:rounded-[10px] file:border-0 file:bg-accent-tint file:px-3 file:py-2 file:font-bold file:text-accent-deep" />
                    {fileName && <p className="mt-2 text-[11px] font-bold text-text-soft">Прикріплено: {fileName}</p>}
                    {fileError && <p role="alert" className="mt-2 text-[11px] font-bold text-alert">{fileError}</p>}
                </Field>
                {submission?.assets?.map(asset => <HomeworkAttachment key={asset.assetId} assetId={asset.assetId} fileName={asset.fileName ?? asset.assetId} />)}
                {!submission?.assets?.length && submission?.fileName && <HomeworkAttachment assetId={submission.assetId} fileName={submission.fileName} />}
                <Button className="w-full" disabled={busy || (!answer.trim() && !file && !submission?.assetId && !submission?.assets?.length)} onClick={submit}>{busy ? 'Збереження…' : wasGraded ? 'Виправити й надіслати повторно' : submission ? 'Оновити й надіслати' : 'Надіслати на перевірку'}</Button>
                {saveError && <p role="alert" className="text-[12px] font-bold text-alert">{saveError}</p>}
                {!busy && !saveError && (sent || submission?.status === 'pending') && <p role="status" className="text-center text-[11px] font-extrabold text-good">Роботу збережено. Вона вже у викладачки.</p>}
            </Card>
        </ProductPage>
    );
};
