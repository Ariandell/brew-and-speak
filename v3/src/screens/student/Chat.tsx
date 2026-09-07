import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../app/AppState';
import { studentTabForRoute, type StudentTab } from '../../app/routes';
import { BottomNav } from '../../ui/BottomNav';
import { Icon } from '../../ui/Icon';
import { AsyncFeedback, asyncErrorMessage, useMountedRef } from '../../ui/AsyncFeedback';
import { inputClass, PageHeader } from '../../ui/ProductUI';

const time = (value: string) => new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export const StudentChat = () => {
    const { state, route, navigate, sendMessage, markConversationRead } = useAppState();
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const mounted = useMountedRef();
    const sendInFlight = useRef(false);
    const messages = useMemo(() => state.messages.filter(item => item.studentId === state.currentUser.id), [state.currentUser.id, state.messages]);
    const nav = (tab: StudentTab) => navigate({ name: tab });
    useEffect(() => { void markConversationRead(state.currentUser.id, 'student').catch(reason => {
        if (mounted.current) setError(asyncErrorMessage(reason, 'Не вдалося оновити статус прочитання.'));
    }); }, [markConversationRead, mounted, state.currentUser.id]);
    const submit = async () => {
        const message = body.trim();
        if (!message || sendInFlight.current) return;
        sendInFlight.current = true; setSending(true); setError('');
        try {
            await sendMessage(state.currentUser.id, message, 'student');
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
            <div className="px-5 pt-[max(24px,env(safe-area-inset-top))]"><PageHeader eyebrow="Прямий зв’язок" title="Чат." description="Напиши викладачці — відповідь залишиться тут." /></div>
            <div className="product-scroll flex-1 space-y-2 overflow-y-auto px-5 py-4 pb-3">
                {messages.map(message => <div key={message.id} className={`flex ${message.from === 'student' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-[18px] px-4 py-3 ${message.from === 'student' ? 'rounded-br-[5px] bg-accent text-white' : 'rounded-bl-[5px] border border-white/70 bg-surface/94 text-text shadow-sm'}`}><p className="text-[13px] font-semibold leading-relaxed">{message.body}</p><span className={`mt-1 block text-right font-mono text-[8px] ${message.from === 'student' ? 'text-white/60' : 'text-text-faint'}`}>{time(message.createdAt)}</span></div></div>)}
            </div>
            {error && <div className="mx-5 mb-2"><AsyncFeedback error={error} /></div>}
            <form onSubmit={event => { event.preventDefault(); void submit(); }} className="glass-panel mx-3 mb-[88px] flex gap-2 rounded-[18px] border border-white/75 bg-surface/95 p-2 shadow-panel">
                <input aria-label="Повідомлення" disabled={sending} value={body} onChange={event => { setBody(event.currentTarget.value); setError(''); }} placeholder="Написати повідомлення…" className={`${inputClass} min-w-0 flex-1 border-0 bg-transparent focus:ring-0`} />
                <button type="submit" disabled={!body.trim() || sending} aria-label={sending ? 'Надсилання повідомлення' : 'Надіслати'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-accent text-white disabled:opacity-40"><Icon name="send" /></button>
            </form>
            <BottomNav active={studentTabForRoute(route)} onSelect={nav} />
        </div>
    );
};
