import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';
import { useUserId } from '../components/TelegramProvider';

const API = '';

interface WordEntry {
    id: number;
    front: string;
    back: string;
    lesson_title: string;
    times_shown: number;
    times_correct: number;
    times_wrong: number;
}

const Dictionary: React.FC = () => {
    const navigate = useNavigate();
    const USER_ID = useUserId();
    const [words, setWords] = useState<WordEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch(`${API}/api/users/${USER_ID}/dictionary`)
            .then(r => r.json())
            .then(data => { setWords(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const filtered = words.filter(w =>
        w.front.toLowerCase().includes(search.toLowerCase()) ||
        w.back.toLowerCase().includes(search.toLowerCase())
    );

    // Group by lesson
    const grouped = filtered.reduce((acc, w) => {
        if (!acc[w.lesson_title]) acc[w.lesson_title] = [];
        acc[w.lesson_title].push(w);
        return acc;
    }, {} as Record<string, WordEntry[]>);

    const getStatusColor = (word: WordEntry) => {
        if (word.times_shown === 0) return '#94a3b8'; // Not studied
        const ratio = word.times_correct / word.times_shown;
        if (ratio >= 0.8) return '#10b981'; // Good
        if (ratio >= 0.5) return '#f59e0b'; // Medium
        return '#ef4444'; // Needs work
    };

    const getStatusLabel = (word: WordEntry) => {
        if (word.times_shown === 0) return 'Нове';
        const ratio = word.times_correct / word.times_shown;
        if (ratio >= 0.8) return 'Вивчено';
        if (ratio >= 0.5) return 'Вивчається';
        return 'Повторити';
    };

    // Global stats
    const totalStudied = words.filter(w => w.times_shown > 0).length;
    const totalMastered = words.filter(w => w.times_shown > 0 && (w.times_correct / w.times_shown) >= 0.8).length;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f6', paddingBottom: '100px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                padding: '1.5rem 1.5rem 3rem',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                boxShadow: '0 10px 30px rgba(124, 58, 237, 0.2)',
                color: 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
                <div style={{ width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
                    <button onClick={() => navigate('/')} style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: 44, height: 44, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Мій Словник</h1>
                </div>
                <p style={{ fontSize: '0.9rem', opacity: 0.85, margin: '0 0 0.75rem' }}>{words.length} слів • {totalMastered} вивчено</p>
                <button onClick={() => navigate('/flashcards')} style={{
                    background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '14px', padding: '10px 20px', fontWeight: 700, fontSize: '0.9rem',
                    cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px',
                    backdropFilter: 'blur(10px)',
                }}>
                    🃏 Вивчати картки
                </button>
            </div>

            {/* Content */}
            <div style={{ padding: '0 1.2rem', marginTop: '-1.5rem', position: 'relative', zIndex: 10 }}>
                {/* Stats mini-cards */}
                {words.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1, backgroundColor: '#ecfdf5', borderRadius: '16px', padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-display)' }}>{totalMastered}</div>
                            <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>Вивчено</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#fef3c7', borderRadius: '16px', padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-display)' }}>{totalStudied - totalMastered}</div>
                            <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>Вивчається</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: '16px', padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-display)' }}>{words.length - totalStudied}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Нові</div>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '0.8rem 1.2rem', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Шукати слово..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ border: 'none', outline: 'none', fontSize: '1rem', flex: 1, fontFamily: 'Inter, system-ui, sans-serif', background: 'transparent', color: '#1e293b' }}
                    />
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontWeight: 600 }}>Завантаження...</div>
                ) : words.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
                        <h3 style={{ fontFamily: 'var(--font-display)', color: '#1e293b', fontWeight: 800, margin: '0 0 0.5rem' }}>Словник поки порожній</h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Пройдіть уроки, щоб побачити нові слова тут!</p>
                    </div>
                ) : (
                    Object.entries(grouped).map(([lessonTitle, lessonWords]) => (
                        <div key={lessonTitle} style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.75rem 0.5rem' }}>{lessonTitle}</h3>
                            <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                                {lessonWords.map((word, idx) => (
                                    <div key={word.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.9rem 1.25rem',
                                        borderBottom: idx < lessonWords.length - 1 ? '1px solid #f1f5f9' : 'none'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>{word.front}</span>
                                            <span style={{ color: '#94a3b8', margin: '0 0.5rem' }}>—</span>
                                            <span style={{ color: '#64748b', fontSize: '0.95rem' }}>{word.back}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                            {word.times_shown > 0 && (
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                                                    {word.times_correct}✓ {word.times_wrong}✕
                                                </span>
                                            )}
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 700,
                                                color: getStatusColor(word),
                                                background: `${getStatusColor(word)}15`,
                                                padding: '3px 8px', borderRadius: '8px'
                                            }}>
                                                {getStatusLabel(word)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <BottomNav />
        </div>
    );
};

export default Dictionary;
