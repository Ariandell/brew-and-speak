import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../app/AppState';
import { teacherTabForRoute, type TeacherTab } from '../../app/routes';
import { Icon } from '../../ui/Icon';
import { AsyncFeedback, asyncErrorMessage, useMountedRef } from '../../ui/AsyncFeedback';
import { Button, Card, EmptyState, Field, inputClass, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';
import { TeacherNav } from '../../ui/TeacherNav';

const time = (value: string) => new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export const TeacherChat = () => {
    const { state, route, navigate, sendMessage, markConversationRead } = useAppState();
    const [selectedId, setSelectedId] = useState(state.students[0]?.id ?? 0);
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const mounted = useMountedRef();
    const sendInFlight = useRef(false);
    const messages = useMemo(() => state.messages.filter(item => item.studentId === selectedId), [selectedId, state.messages]);
    const selected = state.students.find(item => item.id === selectedId);
    const nav = (tab: TeacherTab) => navigate({ name: tab });
    useEffect(() => { if (selectedId) void markConversationRead(selectedId, 'teacher').catch(() => undefined); }, [markConversationRead, selectedId]);
    const submit = async () => {
        const message = body.trim();
        if (!message || !selectedId || sendInFlight.current) return;
        sendInFlight.current = true; setSending(true); setError('');
        try {
            await sendMessage(selectedId, message, 'teacher');
            if (mounted.current) setBody('');
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося надіслати повідомлення. Текст збережено — спробуйте ще раз.'));
        } finally {
            sendInFlight.current = false;
            if (mounted.current) setSending(false);
        }
    };
    return (
        <div className="relative flex h-full flex-col overflow-hidden text-text">
            <div className="px-5 pt-[max(24px,env(safe-area-inset-top))]"><PageHeader eyebrow="Діалоги" title="Чат." description="Один приватний діалог із кожним учнем." /></div>
            <div className="product-scroll flex gap-2 overflow-x-auto px-5 py-3">{state.students.map(student => { const unread = state.messages.filter(item => item.studentId === student.id && item.from === 'student' && !item.read).length; return <button key={student.id} type="button" disabled={sending} onClick={() => { setSelectedId(student.id); setError(''); }} className={`relative shrink-0 rounded-pill border px-3 py-2 text-[11px] font-extrabold disabled:opacity-60 ${student.id === selectedId ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-text-soft'}`}>{student.name}{unread > 0 && <span className="ml-1.5 rounded-pill bg-alert px-1.5 py-0.5 text-[8px] text-white">{unread}</span>}</button>; })}</div>
            <div className="product-scroll flex-1 space-y-2 overflow-y-auto px-5 pb-3">
                {messages.map(message => <div key={message.id} className={`flex ${message.from === 'teacher' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-[18px] px-4 py-3 ${message.from === 'teacher' ? 'rounded-br-[5px] bg-accent text-white' : 'rounded-bl-[5px] bg-surface shadow-card'}`}><p className="text-[13px] font-semibold">{message.body}</p><span className={`mt-1 block text-right font-mono text-[8px] ${message.from === 'teacher' ? 'text-white/60' : 'text-text-faint'}`}>{time(message.createdAt)}</span></div></div>)}
                {!messages.length && <EmptyState icon="chat" title="Діалог порожній" copy={`Напиши перше повідомлення для ${selected?.name ?? 'учня'}.`} />}
            </div>
            {error && <div className="mx-5 mb-2"><AsyncFeedback error={error} /></div>}
            <form onSubmit={event => { event.preventDefault(); void submit(); }} className="glass-panel mx-3 mb-[88px] flex gap-2 rounded-[18px] bg-surface/95 p-2 shadow-panel"><input aria-label="Повідомлення" disabled={sending} value={body} onChange={event => { setBody(event.currentTarget.value); setError(''); }} placeholder={`Відповісти ${selected?.name ?? ''}…`} className={`${inputClass} min-w-0 flex-1 border-0 bg-transparent focus:ring-0`} /><button type="submit" disabled={!body.trim() || !selectedId || sending} aria-label={sending ? 'Надсилання повідомлення' : 'Надіслати'} className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-accent text-white disabled:opacity-40"><Icon name="send" /></button></form>
            <TeacherNav active={teacherTabForRoute(route)} onSelect={nav} />
        </div>
    );
};

export const Broadcasts = () => {
    const { state, createBroadcast, deleteBroadcast, back } = useAppState();
    const [caption, setCaption] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 3600000).toISOString().slice(0, 16));
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const mounted = useMountedRef();
    const actionInFlight = useRef(false);
    const submit = async () => {
        if (!image || actionInFlight.current) return;
        actionInFlight.current = true; setBusy(true); setError(''); setNotice(''); setSaved(false);
        try {
            await createBroadcast(caption, image, new Date(scheduledAt).toISOString());
            if (!mounted.current) return;
            setCaption(''); setImage(null); setSaved(true); setNotice('Розсилку успішно заплановано.');
            if (fileInput.current) fileInput.current.value = '';
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося запланувати розсилку. Спробуйте ще раз.'));
        } finally {
            actionInFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const remove = async (broadcastId: string) => {
        if (actionInFlight.current) return;
        actionInFlight.current = true; setDeletingId(broadcastId); setError(''); setNotice(''); setSaved(false);
        try {
            await deleteBroadcast(broadcastId);
            if (mounted.current) setNotice('Розсилку видалено.');
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося видалити розсилку. Спробуйте ще раз.'));
        } finally {
            actionInFlight.current = false;
            if (mounted.current) setDeletingId(null);
        }
    };
    return (
        <ProductPage>
            <PageHeader eyebrow="Фото учням" title="Розсилка." description="Майбутня дата справді відкладає публікацію." onBack={() => back({ name: 'teacher' })} />
            <Card className="mt-5 space-y-4 p-5">
                <Field label="Фото" hint="image до 20 МБ"><input ref={fileInput} disabled={busy || deletingId !== null} type="file" accept="image/*" onChange={event => { setImage(event.currentTarget.files?.[0] ?? null); setSaved(false); setNotice(''); setError(''); }} className="block w-full text-[12px] font-semibold text-text-soft file:mr-3 file:rounded-[10px] file:border-0 file:bg-accent-tint file:px-3 file:py-2 file:font-bold file:text-accent-deep" /></Field>
                <Field label="Підпис"><textarea disabled={busy || deletingId !== null} rows={4} value={caption} onChange={event => { setCaption(event.currentTarget.value); setSaved(false); setNotice(''); }} className={`${inputClass} resize-none`} placeholder="Коротке повідомлення…" /></Field>
                <Field label="Дата й час"><input disabled={busy || deletingId !== null} type="datetime-local" value={scheduledAt} onChange={event => { setScheduledAt(event.currentTarget.value); setSaved(false); setNotice(''); }} className={inputClass} /></Field>
                <Button className="w-full" icon="broadcast" disabled={!image || !scheduledAt || busy || deletingId !== null} onClick={() => void submit()}>{busy ? 'Завантаження…' : saved ? 'Заплановано' : 'Запланувати розсилку'}</Button>
                <AsyncFeedback error={error} success={notice} />
            </Card>
            <h2 className="mt-7 text-[19px] font-black">Історія</h2>
            <div className="mt-3 space-y-2">{state.broadcasts.map(item => <Card key={item.id} className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent-tint text-accent"><Icon name="broadcast" /></span><div className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-black">{item.caption || item.imageName}</strong><p className="mt-1 text-[9px] font-semibold text-text-faint">{new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.scheduledAt))}</p></div><StatusPill tone={Date.parse(item.scheduledAt) <= Date.now() ? 'green' : 'warm'}>{Date.parse(item.scheduledAt) <= Date.now() ? 'Надіслано' : 'Заплановано'}</StatusPill><button type="button" disabled={busy || deletingId !== null} onClick={() => void remove(item.id)} aria-label={deletingId === item.id ? `Видалення розсилки ${item.caption || item.imageName}` : `Видалити розсилку ${item.caption || item.imageName}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-alert disabled:opacity-40"><Icon name="trash" className="h-4 w-4" /></button></Card>)}</div>
        </ProductPage>
    );
};
