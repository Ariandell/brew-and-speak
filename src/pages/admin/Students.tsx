import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '';

interface Student {
    id: number;
    telegram_id: string;
    name: string;
    username: string | null;
    role: string;
    is_blocked: number;
    course_title: string | null;
    completed: number;
    last_completed: string | null;
    pending_homework: number;
}

const card: React.CSSProperties = {
    backgroundColor: 'white', borderRadius: '16px', padding: '1rem 1.2rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '0.75rem'
};

const pill = (bg: string, color: string): React.CSSProperties => ({
    background: bg, color, padding: '3px 9px', borderRadius: '8px',
    fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap'
});

const Students: React.FC = () => {
    const navigate = useNavigate();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<'active' | 'blocked'>('active');
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState('');

    const load = () => {
        setLoading(true);
        fetch(`${API}/api/admin/students`)
            .then(r => r.json())
            .then(d => setStudents(Array.isArray(d) ? d : []))
            .catch(() => setError('Не вдалося завантажити список.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const setAccess = async (student: Student, action: 'block' | 'unblock') => {
        setBusy(student.id);
        setError('');
        try {
            const res = await fetch(`${API}/api/admin/students/${student.id}/${action}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) { setError(data?.error || 'Не вдалося змінити доступ.'); return; }
            setStudents(prev => prev.map(s => s.id === student.id ? { ...s, is_blocked: data.is_blocked } : s));
        } catch {
            setError('Немає зв\'язку з сервером.');
        } finally {
            setBusy(null);
        }
    };

    // Search covers everything the teacher might remember a student by.
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return students
            .filter(s => (tab === 'blocked') === (Number(s.is_blocked) === 1))
            .filter(s => !q || [s.name, s.username, s.telegram_id].some(v => String(v || '').toLowerCase().includes(q)));
    }, [students, query, tab]);

    const blockedCount = students.filter(s => Number(s.is_blocked) === 1).length;
    const activeCount = students.length - blockedCount;

    const formatDate = (value: string | null) => {
        if (!value) return 'ще не починав';
        const d = new Date(value.includes('Z') ? value : value + 'Z');
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uk-UA');
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '2rem' }}>
            <header style={{ padding: '0.8rem 1rem', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 20 }}>
                <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, fontSize: '1rem', fontFamily: 'inherit' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Назад
                </button>
                <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1, textAlign: 'center', color: '#1a1a2e' }}>👥 Учні</h1>
                <div style={{ width: 70 }} />
            </header>

            <div style={{ padding: '1rem' }}>
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Пошук за іменем, @username або ID"
                    // background as well as colour: leaving either to the system
                    // paints a dark box under dark mode, which the WebView applies.
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'white', color: '#1a1a2e', marginBottom: '0.75rem' }}
                />

                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                    {([['active', `Активні (${activeCount})`], ['blocked', `Заблоковані (${blockedCount})`]] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setTab(key)} style={{
                            flex: 1, padding: '10px', border: '2px solid', borderColor: tab === key ? 'var(--color-primary)' : '#e2e8f0',
                            borderRadius: '12px', background: tab === key ? '#ede9fe' : 'white', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: tab === key ? 700 : 500, color: '#1a1a2e'
                        }}>{label}</button>
                    ))}
                </div>

                {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '10px 14px', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Завантаження...</div>
                ) : visible.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{query ? '🔍' : '👥'}</div>
                        <p style={{ fontWeight: 600, margin: 0 }}>
                            {query ? 'Нікого не знайдено' : tab === 'blocked' ? 'Немає заблокованих учнів' : 'Учнів поки немає'}
                        </p>
                    </div>
                ) : visible.map(s => {
                    const blocked = Number(s.is_blocked) === 1;
                    const isTeacher = s.role === 'teacher';
                    return (
                        <div key={s.id} style={card}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{s.name || 'Без імені'}</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                                        {s.username ? `@${s.username}` : `ID ${s.telegram_id}`}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {isTeacher && <span style={pill('#ede9fe', '#6d28d9')}>Викладач</span>}
                                    {blocked && <span style={pill('#fee2e2', '#b91c1c')}>Доступ обмежено</span>}
                                    {s.pending_homework > 0 && <span style={pill('#fef3c7', '#92400e')}>ДЗ: {s.pending_homework}</span>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', color: '#64748b', marginBottom: isTeacher ? 0 : '10px', flexWrap: 'wrap' }}>
                                <span>📗 {s.course_title || 'без курсу'}</span>
                                <span>✅ {s.completed} уроків</span>
                                <span>🕓 {formatDate(s.last_completed)}</span>
                            </div>

                            {!isTeacher && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => navigate('/admin/chat')}
                                        style={{ flex: 1, padding: '9px', border: '1px solid #e2e8f0', borderRadius: '10px', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}
                                    >💬 Почати чат</button>
                                    <button
                                        onClick={() => setAccess(s, blocked ? 'unblock' : 'block')}
                                        disabled={busy === s.id}
                                        style={{
                                            flex: 1, padding: '9px', border: 'none', borderRadius: '10px',
                                            background: blocked ? '#d1fae5' : '#fee2e2', color: blocked ? '#047857' : '#b91c1c',
                                            cursor: busy === s.id ? 'default' : 'pointer', fontFamily: 'inherit',
                                            fontSize: '0.85rem', fontWeight: 700, opacity: busy === s.id ? 0.6 : 1
                                        }}
                                    >{busy === s.id ? '...' : blocked ? '✅ Розблокувати' : '🚫 Заблокувати'}</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Students;
