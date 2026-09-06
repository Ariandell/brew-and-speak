import { useMemo, useRef, useState } from 'react';
import { useAppState } from '../../app/AppState';
import { teacherTabForRoute, type TeacherTab } from '../../app/routes';
import { Icon } from '../../ui/Icon';
import { AsyncFeedback, asyncErrorMessage, useMountedRef } from '../../ui/AsyncFeedback';
import { Button, Card, EmptyState, inputClass, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';
import { TeacherNav } from '../../ui/TeacherNav';

export const TeacherStudents = () => {
    const { state, route, navigate } = useAppState();
    const [query, setQuery] = useState('');
    const students = useMemo(() => state.students.filter(student => `${student.name} ${student.username ?? ''} ${student.id}`.toLowerCase().includes(query.toLowerCase())), [query, state.students]);
    const nav = (tab: TeacherTab) => navigate({ name: tab });
    return (
        <ProductPage nav={<TeacherNav active={teacherTabForRoute(route)} onSelect={nav} />}>
            <PageHeader eyebrow="Люди" title="Учні." description={`${state.students.length} активних профілів у базі`} />
            <div className="relative mt-5"><Icon name="search" className="absolute left-3.5 top-3.5 h-5 w-5 text-text-faint" /><input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="Ім’я, @username або ID" className={`${inputClass} pl-11`} /></div>
            <div className="mt-4 space-y-2">{students.map(student => <button key={student.id} type="button" onClick={() => navigate({ name: 'teacher-student', studentId: student.id })} className="block w-full text-left"><Card className="flex items-center gap-3 p-4"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-tint text-[14px] font-black text-accent">{student.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-[15px] font-black">{student.name}</strong>{student.isBlocked && <StatusPill tone="red">Заблоковано</StatusPill>}</div><p className="mt-1 text-[10px] font-semibold text-text-faint">{student.username ? `@${student.username}` : `ID ${student.id}`} · {student.completedLessons}/{student.totalLessons} уроків</p></div><Icon name="arrow" className="h-5 w-5 text-text-faint" /></Card></button>)}</div>
            {!students.length && <EmptyState icon="search" title="Учня не знайдено" copy="Перевір ім’я, username або Telegram ID." />}
        </ProductPage>
    );
};

export const TeacherStudent = ({ studentId }: { studentId: number }) => {
    const { state, toggleStudentBlocked, navigate, back } = useAppState();
    const student = state.students.find(item => item.id === studentId);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const mounted = useMountedRef();
    const actionInFlight = useRef(false);
    if (!student) return <ProductPage><PageHeader title="Учня не знайдено" onBack={() => back({ name: 'teacher-students' })} /></ProductPage>;
    const progress = student.totalLessons ? Math.round(student.completedLessons / student.totalLessons * 100) : 0;
    const pending = state.homework.filter(item => item.studentId === studentId && item.status === 'pending').length;
    const toggleAccess = async () => {
        if (actionInFlight.current) return;
        const restoring = student.isBlocked;
        actionInFlight.current = true; setBusy(true); setError(''); setNotice('');
        try {
            await toggleStudentBlocked(student.id);
            if (mounted.current) setNotice(restoring ? 'Доступ учня відновлено.' : 'Доступ учня заблоковано.');
        } catch (reason) {
            if (mounted.current) setError(asyncErrorMessage(reason, restoring ? 'Не вдалося відновити доступ учня.' : 'Не вдалося заблокувати доступ учня.'));
        } finally {
            actionInFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    return (
        <ProductPage>
            <PageHeader eyebrow={`Student · ${student.id}`} title={student.name} description={student.username ? `@${student.username}` : 'Без username'} onBack={() => back({ name: 'teacher-students' })} action={<StatusPill tone={student.isBlocked ? 'red' : 'green'}>{student.isBlocked ? 'Blocked' : 'Active'}</StatusPill>} />
            <div className="mt-5 grid grid-cols-3 gap-2">{[['Прогрес', `${progress}%`], ['Середній', student.averageScore?.toFixed(1) ?? '—'], ['Чекає ДЗ', `${pending}`]].map(([label, value]) => <Card key={label} className="p-3 text-center"><strong className="block text-[22px] font-black text-accent">{value}</strong><span className="text-[8px] font-bold uppercase tracking-[0.07em] text-text-faint">{label}</span></Card>)}</div>
            <Card className="mt-3 p-5"><div className="flex justify-between text-[12px] font-bold"><span>Курс</span><span>{student.completedLessons}/{student.totalLessons}</span></div><div className="mt-3 h-2 overflow-hidden rounded-pill bg-accent-tint"><span className="block h-full rounded-pill bg-accent" style={{ width: `${progress}%` }} /></div></Card>
            <Button className="mt-4 w-full" icon="chat" onClick={() => navigate({ name: 'teacher-chat' })}>Відкрити чат</Button>
            <Button tone={student.isBlocked ? 'secondary' : 'danger'} disabled={busy} className="mt-3 w-full" onClick={() => void toggleAccess()}>{busy ? 'Застосування…' : student.isBlocked ? 'Відновити доступ' : 'Заблокувати доступ'}</Button>
            <div className="mt-2"><AsyncFeedback error={error} success={notice} /></div>
            <p className="mt-2 text-center text-[10px] font-semibold text-text-faint">Блокування застосовується сервером до всіх захищених даних.</p>
        </ProductPage>
    );
};
