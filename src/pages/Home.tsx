import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';
import { CircularProgress } from '../components/ui/CircularProgress';
import { EnvelopeOverlay } from '../components/EnvelopeOverlay';

const API = '''';
const USER_ID = 'demo-user';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
    const [showEnvelope, setShowEnvelope] = useState(false);
    const [enrollment, setEnrollment] = useState<any>(null);
    const [coursePath, setCoursePath] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [checkingEnrollment, setCheckingEnrollment] = useState(true);

    useEffect(() => {
        // First check enrollment
        fetch(`${API}/api/users/${USER_ID}/enrollment`)
            .then(r => r.json())
            .then(async data => {
                setEnrollment(data);

                if (data.courseId) {
                    // Fetch full course path with user progress
                    const pathRes = await fetch(`${API}/api/courses/${data.courseId}/path/${USER_ID}`);
                    const pathData = await pathRes.json();
                    setCoursePath(pathData);
                }
            })
            .catch(() => setEnrollment({ courseId: null, course: null }))
            .finally(() => { setCheckingEnrollment(false); setLoading(false); });

        // Pending photo messages (envelope)
        fetch(`${API}/api/photo-messages/pending/${USER_ID}`)
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setPendingPhotos(data);
                    setShowEnvelope(true);
                }
            })
            .catch(() => { });
    }, []);

    const handlePhotoViewed = (id: number) => {
        fetch(`${API}/api/photo-messages/${id}/viewed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID })
        }).catch(() => { });
    };

    // Helper to format remaining time
    const formatTimeLeft = (unlocksAt: string) => {
        const now = new Date().getTime();
        const unlockTime = new Date(unlocksAt).getTime();
        const diff = unlockTime - now;

        if (diff <= 0) return 'Доступно зараз';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `через ${hours} год ${minutes} хв`;
        return `через ${minutes} хв`;
    };

    if (checkingEnrollment) return null; // Wait for enrollment check before routing

    // Optional: if not enrolled, redirect to course selection
    if (!enrollment?.courseId && !loading) {
        navigate('/courses');
        return null;
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f6', paddingBottom: '100px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header / Hero */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: 'white',
                padding: '3rem 1.5rem 5rem',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                boxShadow: '0 10px 30px rgba(124, 58, 237, 0.2)'
            }}>
                <h1 style={{ fontSize: '1.8rem', margin: 0, fontWeight: 900, letterSpacing: '-0.5px' }}>Привіт 👋</h1>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', margin: '6px 0 0', fontWeight: 500 }}>Готові підкорювати вершини?</p>
            </div>

            <div style={{ padding: '0 1.2rem', marginTop: '-3rem', position: 'relative', zIndex: 10 }}>
                {/* Course Overview Card */}
                <div
                    className="animate-fade-in"
                    style={{
                        animationDelay: '0.1s',
                        backgroundColor: 'white', borderRadius: '24px', padding: '1.75rem',
                        boxShadow: '0 12px 35px rgba(0,0,0,0.06)', marginBottom: '2.5rem',
                        border: '1px solid rgba(0,0,0,0.03)'
                    }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#a0aec0', padding: '1.5rem', fontWeight: 500 }}>Завантаження курсу...</div>
                    ) : enrollment?.course ? (
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                            <div style={{ filter: 'drop-shadow(0 4px 6px rgba(124, 58, 237, 0.15))' }}>
                                <CircularProgress progress={enrollment.completedLessons || 0} total={coursePath.length || 1} size={80} strokeWidth={8} color="#7c3aed" trackColor="#f3f4f6" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>ПОТОЧНИЙ КУРС</p>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>{enrollment.course.title}</h3>
                                {enrollment.completedLessons >= coursePath.length && coursePath.length > 0 ? (
                                    <p style={{ margin: '8px 0 0', fontSize: '0.95rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '1.1em' }}>🎉</span> Курс завершено!
                                    </p>
                                ) : (
                                    <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>{enrollment.completedLessons} / {coursePath.length} завдань</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.1))' }}>📚</div>
                            <p style={{ fontWeight: 700, margin: '0 0 16px', color: '#1e293b', fontSize: '1.1rem' }}>Курс не обрано</p>
                            <button onClick={(e) => { e.stopPropagation(); navigate('/courses'); }} style={{
                                padding: '12px 28px', border: 'none', borderRadius: '16px',
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                                boxShadow: '0 4px 15px rgba(124, 58, 237, 0.3)',
                                fontSize: '1rem', transition: 'transform 0.2s'
                            }}>Обрати курс</button>
                        </div>
                    )}
                </div>

                {/* Path Timeline */}
                {coursePath.length > 0 && (
                    <div style={{ position: 'relative', marginLeft: '4px', marginBottom: '3rem' }}>

                        {/* Background continuous line - perfectly centered inside the 32px left column */}
                        <div className="animate-line" style={{
                            position: 'absolute', top: '16px', bottom: '24px', left: '15px',
                            width: '3px', backgroundColor: '#e2e8f0', borderRadius: '4px', zIndex: 0
                        }} />

                        {coursePath.map((lesson, idx) => {
                            const isCompleted = lesson.status === 'completed';
                            const isUnlocked = lesson.status === 'unlocked';
                            const isLocked = lesson.status === 'locked';
                            const delayBase = 0.2 + idx * 0.15;
                            const cardDelay = `${delayBase}s`;
                            const dotDelay = `${delayBase + 0.1}s`;

                            return (
                                <div key={lesson.id} style={{ display: 'flex', gap: '16px', position: 'relative', paddingBottom: idx === coursePath.length - 1 ? 0 : '2.5rem' }}>

                                    {/* Timeline dot column */}
                                    <div style={{ width: '32px', flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '16px', zIndex: 2 }}>
                                        <div className={isUnlocked ? "animate-pop-active" : "animate-pop"} style={{
                                            animationDelay: dotDelay, opacity: 0,
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            backgroundColor: isCompleted ? '#10b981' : isUnlocked ? '#7c3aed' : '#f8fafc',
                                            border: isLocked ? '2px solid #cbd5e1' : 'none',
                                            boxShadow: isUnlocked ? '0 0 0 6px rgba(124, 58, 237, 0.15)' : (isCompleted ? '0 4px 10px rgba(16, 185, 129, 0.25)' : 'none'),
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {isCompleted && (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                            {isUnlocked && (
                                                <div style={{ width: '10px', height: '10px', backgroundColor: 'white', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></div>
                                            )}
                                            {isLocked && (
                                                <div style={{ width: '8px', height: '8px', backgroundColor: '#cbd5e1', borderRadius: '50%' }}></div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lesson Card Wrapper */}
                                    <div
                                        className="animate-fade-in"
                                        style={{ animationDelay: cardDelay, opacity: 0, flex: 1 }}
                                    >
                                        <div
                                            onClick={() => (isCompleted || isUnlocked) && navigate(`/lesson/${lesson.id}`)}
                                            style={{
                                                backgroundColor: 'white',
                                                borderRadius: '24px', padding: '1.25rem 1.5rem',
                                                boxShadow: isUnlocked ? '0 12px 30px rgba(124, 58, 237, 0.12)' : (isCompleted ? '0 4px 15px rgba(0,0,0,0.04)' : 'none'),
                                                border: isUnlocked ? '2px solid #7c3aed' : (isLocked ? '1px dashed #cbd5e1' : '1px solid rgba(0,0,0,0.04)'),
                                                cursor: (isCompleted || isUnlocked) ? 'pointer' : 'default',
                                                filter: isLocked ? 'opacity(0.6) grayscale(0.2)' : 'none',
                                                position: 'relative', overflow: 'hidden',
                                                transition: 'box-shadow 0.2s'
                                            }}>

                                            {isUnlocked && (
                                                <div style={{ position: 'absolute', top: 0, left: 0, width: '5px', height: '100%', background: 'linear-gradient(to bottom, #4f46e5, #7c3aed)' }} />
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ flex: 1, paddingRight: '1rem' }}>
                                                    <p style={{
                                                        margin: '0 0 4px', fontSize: '0.72rem', fontWeight: 800,
                                                        color: isCompleted ? '#059669' : isUnlocked ? '#7c3aed' : '#94a3b8',
                                                        textTransform: 'uppercase', letterSpacing: '0.8px'
                                                    }}>
                                                        Урок {idx + 1}
                                                    </p>
                                                    <h4 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.2rem', fontWeight: 800, color: isLocked ? '#64748b' : '#0f172a', lineHeight: 1.3 }}>
                                                        {lesson.title}
                                                    </h4>
                                                </div>

                                                <div style={{ flexShrink: 0 }}>
                                                    {isCompleted && <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', padding: '6px 14px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600 }}>Пройдено</div>}
                                                    {isUnlocked && <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', padding: '8px 20px', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 700, boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)' }}>Почати</div>}
                                                    {isLocked && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            <span style={{ fontSize: '0.9rem' }}>🔒</span>
                                                            {lesson.unlocks_at ? formatTimeLeft(lesson.unlocks_at) : 'Заблоковано'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Quick actions */}
                <div className="animate-fade-in" style={{ animationDelay: '0.6s', opacity: 0 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>Навчання</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)', cursor: 'pointer' }}
                            onClick={() => navigate('/dictionary')}>
                            <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>📖</div>
                            <div>
                                <h3 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Мій Словник</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Усі вивчені слова</p>
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)', cursor: 'pointer' }}
                            onClick={() => navigate('/flashcards')}>
                            <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>🃏</div>
                            <div>
                                <h3 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Флеш-картки</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Тренуй лексику</p>
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)', cursor: 'pointer' }}
                            onClick={() => navigate('/chat')}>
                            <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>💬</div>
                            <div>
                                <h3 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Чат з викладачем</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>Отримай зворотній зв'язок</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <BottomNav />

            {showEnvelope && pendingPhotos.length > 0 && (
                <EnvelopeOverlay messages={pendingPhotos} onClose={() => setShowEnvelope(false)} onViewed={handlePhotoViewed} />
            )}
        </div>
    );
};

export default Home;
