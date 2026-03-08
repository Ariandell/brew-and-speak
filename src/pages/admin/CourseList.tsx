import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Level {
    id: number;
    title: string;
    description: string;
    lesson_count: number;
}

const CourseList: React.FC = () => {
    const navigate = useNavigate();
    const [levels, setLevels] = useState<Level[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchLevels = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/levels');
            const data = await res.json();
            setLevels(Array.isArray(data) ? data : []);
        } catch {
            setLevels([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLevels(); }, []);

    const createCourse = async () => {
        if (!newTitle.trim()) return;
        setSaving(true);
        try {
            await fetch('/api/levels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle.trim(), description: newDesc.trim() })
            });
            setNewTitle('');
            setNewDesc('');
            setShowForm(false);
            await fetchLevels();
        } finally {
            setSaving(false);
        }
    };

    const deleteCourse = async (id: number) => {
        if (!confirm('Видалити цей курс?')) return;
        await fetch(`/api/levels/${id}`, { method: 'DELETE' });
        await fetchLevels();
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{
                padding: '0.8rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'sticky',
                top: 0,
                zIndex: 20
            }}>
                <button
                    onClick={() => navigate('/admin')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, fontSize: '1rem', fontFamily: 'inherit' }}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Назад
                </button>
                <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, flex: 1, textAlign: 'center' }}>📚 Курси</h1>
                <div style={{ width: 70 }}></div>
            </header>

            <div style={{ padding: '1rem', flex: 1 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Завантаження...</div>
                ) : (
                    <>
                        {levels.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
                                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Курсів ще немає</p>
                                <p style={{ fontSize: '0.9rem' }}>Натисніть «Новий курс», щоб почати!</p>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            {levels.map(level => (
                                <div
                                    key={level.id}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        padding: '1rem 1.2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate(`/admin/courses/${level.id}/lessons`)}
                                >
                                    <div style={{
                                        width: 50, height: 50, borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.5rem', flexShrink: 0
                                    }}>
                                        📖
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1a1a2e' }}>{level.title}</h3>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#888' }}>
                                            {level.lesson_count || 0} {getUkrLessonWord(level.lesson_count || 0)}
                                            {level.description ? ` · ${level.description}` : ''}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteCourse(level.id); }}
                                            style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', width: 34, height: 34, color: '#ef4444', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            🗑️
                                        </button>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* New course form */}
                        {showForm ? (
                            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Новий курс</h3>
                                <input
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Назва курсу (напр: Англійська A1)"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.75rem' }}
                                    autoFocus
                                />
                                <input
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    placeholder="Опис (необов'язково)"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '1rem' }}
                                />
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        style={{ flex: 1, padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95rem' }}
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        onClick={createCourse}
                                        disabled={!newTitle.trim() || saving}
                                        style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '12px', background: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 600, opacity: !newTitle.trim() ? 0.5 : 1 }}
                                    >
                                        {saving ? 'Зберігаємо...' : '✅ Зберегти'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowForm(true)}
                                style={{
                                    width: '100%', padding: '1rem', border: '2px dashed #c4b5fd',
                                    borderRadius: '16px', background: 'transparent', cursor: 'pointer',
                                    color: 'var(--color-primary)', fontFamily: 'inherit', fontSize: '1rem',
                                    fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                ➕ Новий курс
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

function getUkrLessonWord(count: number): string {
    if (count === 1) return 'урок';
    if (count >= 2 && count <= 4) return 'уроки';
    return 'уроків';
}

export default CourseList;
