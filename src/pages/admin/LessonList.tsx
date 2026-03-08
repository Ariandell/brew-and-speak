import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface Lesson {
    id: number;
    title: string;
    order: number;
}

interface Level {
    id: number;
    title: string;
}

const LessonList: React.FC = () => {
    const navigate = useNavigate();
    const { courseId } = useParams<{ courseId: string }>();
    const [level, setLevel] = useState<Level | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [levelRes, lessonsRes] = await Promise.all([
                fetch(`/api/levels`),
                fetch(`/api/levels/${courseId}/lessons`)
            ]);
            const allLevels = await levelRes.json();
            const levelData = Array.isArray(allLevels) ? allLevels.find((l: Level) => l.id === Number(courseId)) : null;
            setLevel(levelData || null);

            const lessonsData = await lessonsRes.json();
            setLessons(Array.isArray(lessonsData) ? lessonsData : []);
        } catch {
            setLessons([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [courseId]);

    const createLesson = async () => {
        if (!newTitle.trim()) return;
        setSaving(true);
        try {
            await fetch(`/api/levels/${courseId}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle.trim() })
            });
            setNewTitle('');
            setShowForm(false);
            await fetchData();
        } finally {
            setSaving(false);
        }
    };

    const deleteLesson = async (id: number) => {
        if (!confirm('Видалити цей урок?')) return;
        await fetch(`/api/lessons/${id}`, { method: 'DELETE' });
        await fetchData();
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
                    onClick={() => navigate('/admin/courses')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, fontSize: '1rem', fontFamily: 'inherit' }}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Назад
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#1a1a2e' }}>{level?.title || 'Урок'}</h1>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>Список уроків</p>
                </div>
                <div style={{ width: 70 }}></div>
            </header>

            <div style={{ padding: '1rem', flex: 1 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Завантаження...</div>
                ) : (
                    <>
                        {lessons.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📖</div>
                                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Уроків ще немає</p>
                                <p style={{ fontSize: '0.9rem' }}>Додайте перший урок!</p>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            {lessons.map((lesson, index) => (
                                <div
                                    key={lesson.id}
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
                                    onClick={() => navigate(`/admin/lesson/${lesson.id}`)}
                                >
                                    <div style={{
                                        width: 44, height: 44, borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, color: 'var(--color-primary)', fontSize: '1rem',
                                        flexShrink: 0
                                    }}>
                                        {index + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {lesson.title}
                                        </h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#aaa' }}>Натисніть, щоб редагувати</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteLesson(lesson.id); }}
                                            style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', width: 34, height: 34, color: '#ef4444', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            🗑️
                                        </button>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* New lesson form */}
                        {showForm ? (
                            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Новий урок</h3>
                                <input
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Назва уроку (напр: Present Simple)"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '1rem' }}
                                    autoFocus
                                />
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        style={{ flex: 1, padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95rem' }}
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        onClick={createLesson}
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
                                ➕ Додати урок
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LessonList;
