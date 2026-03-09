import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';
import { CircularProgress } from '../components/ui/CircularProgress';
import { EnvelopeOverlay } from '../components/EnvelopeOverlay';
import { useUserId, useTelegram } from '../components/TelegramProvider';

const API = '';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const { ready } = useTelegram();
    const USER_ID = useUserId();
    const [pendingPhotos, setPendingPhotos] = useState<any[]>([]);
    const [showEnvelope, setShowEnvelope] = useState(false);
    const [enrollment, setEnrollment] = useState<any>(() => {
        // Initialize from localStorage cache to avoid redirect on cold start
        try {
            const cached = localStorage.getItem(`enrollment_${USER_ID || 'default'}`);
            return cached ? JSON.parse(cached) : null;
        } catch { return null; }
    });
    const [coursePath, setCoursePath] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [checkingEnrollment, setCheckingEnrollment] = useState(true);
    const [enrollmentChecked, setEnrollmentChecked] = useState(false); // true = API responded successfully

    useEffect(() => {
        if (!ready || !USER_ID) return;

        setLoading(true);
        // Check enrollment from API
        fetch(`${API}/api/users/${USER_ID}/enrollment`)
            .then(r => {
                if (!r.ok) throw new Error('API error');
                return r.json();
            })
            .then(async data => {
                setEnrollment(data);
                setEnrollmentChecked(true); // API responded successfully

                if (data.courseId) {
                    // Cache successful enrollment
                    try { localStorage.setItem(`enrollment_${USER_ID}`, JSON.stringify(data)); } catch { }

                    // Fetch full course path with user progress
                    const pathRes = await fetch(`${API}/api/courses/${data.courseId}/path/${USER_ID}`);
                    const pathData = await pathRes.json();
                    setCoursePath(pathData);
                } else {
                    // API confirmed: no enrollment. Clear cache.
                    try { localStorage.removeItem(`enrollment_${USER_ID}`); } catch { }
                }
            })
            .catch(() => {
                // API failed (cold start, network error) — DON'T redirect
                // Keep using cached enrollment if available
                console.warn('Enrollment API failed, using cached data');
                setEnrollmentChecked(false);

                // If we have cached enrollment, try to load course path
                const cached = enrollment;
                if (cached?.courseId) {
                    fetch(`${API}/api/courses/${cached.courseId}/path/${USER_ID}`)
                        .then(r => r.json())
                        .then(data => setCoursePath(data))
                        .catch(() => { });
                }
            })
            .finally(() => {
                setCheckingEnrollment(false);
                setLoading(false);
            });

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
    }, [USER_ID]);

    const handlePhotoViewed = (id: number) => {
        fetch(`${API}/api/photo-messages/${id}/viewed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID })
        }).catch(() => { });
    };

    // Helper to format remaining time
    const formatTimeLeft = (unlocksAt: string | number) => {
        const now = new Date().getTime();
        const unlockTime = new Date(unlocksAt).getTime();
        const diff = unlockTime - now;

        if (diff <= 0) return 'Доступно зараз';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `через ${hours} год ${minutes} хв`;
        return `через ${minutes} хв`;
    };

    const getReplayTimeLeft = (completedAt: string | number) => {
        const lastCompleted = new Date(completedAt).getTime();
        const replayAt = lastCompleted + (24 * 60 * 60 * 1000);
        const now = new Date().getTime();
        const diff = replayAt - now;

        if (diff <= 0) return null;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return hours > 0 ? `${hours}г ${minutes}хв` : `${minutes}хв`;
    };

    if (!ready || checkingEnrollment) return null;

    // Only redirect to /courses if API SUCCESSFULLY confirmed no enrollment
    // (not if API failed due to cold start / network error)
    if (!enrollment?.courseId && !loading && enrollmentChecked) {
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
                        boxShadow: '0 12px 35px rgba(0,0,0,0.06)', marginBottom: '2rem',
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

                {/* Feedback Section (if any) */}
                {coursePath.some(l => l.homework_feedback || l.homework_grade) && (
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📝 Фідбек до ДЗ
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {coursePath.filter(l => l.homework_feedback || l.homework_grade).map(lesson => (
                                <div key={lesson.id} style={{ background: 'white', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid #e0e7ff' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 800, color: '#1e293b' }}>{lesson.title}</span>
                                        <span style={{ fontWeight: 800, color: '#4f46e5', background: '#eef2ff', padding: '2px 10px', borderRadius: '10px', fontSize: '0.9rem' }}>
                                            {lesson.homework_grade}/100
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#475569', lineHeight: 1.5 }}>
                                        {lesson.homework_feedback || "Молодець! Чудова робота."}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Path Timeline */}
                {coursePath.length > 0 && (
                    <div style={{ position: 'relative', marginLeft: '4px', marginBottom: '3rem' }}>
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

                                    <div className="animate-fade-in" style={{ animationDelay: cardDelay, opacity: 0, flex: 1 }}>
                                        <div
                                            onClick={() => (isCompleted || isUnlocked) && navigate(`/lesson/${lesson.id}`)}
                                            style={{
                                                backgroundColor: 'white',
                                                borderRadius: '24px', padding: '1.25rem 1.5rem',
                                                boxShadow: isUnlocked ? '0 12px 30px rgba(124, 58, 237, 0.12)' : (isCompleted ? '0 4px 15px rgba(0,0,0,0.04)' : 'none'),
                                                border: isUnlocked ? '2px solid #7c3aed' : (isLocked ? '1px dashed #cbd5e1' : '1px solid rgba(0,0,0,0.04)'),
                                                cursor: (isCompleted || isUnlocked) ? 'pointer' : 'default',
                                                filter: isLocked ? 'opacity(0.6) grayscale(0.2)' : 'none',
                                                transition: 'box-shadow 0.2s'
                                            }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: 800, color: isCompleted ? '#059669' : isUnlocked ? '#7c3aed' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Урок {idx + 1}</p>
                                                    <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: isLocked ? '#64748b' : '#0f172a' }}>{lesson.title}</h4>
                                                </div>
                                                <div style={{ flexShrink: 0 }}>
                                                    {isCompleted && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                            <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', padding: '6px 14px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600 }}>Пройдено</div>
                                                            {lesson.completed_at && getReplayTimeLeft(lesson.completed_at) && (
                                                                <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                                                                    Повтор за {getReplayTimeLeft(lesson.completed_at)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {isUnlocked && <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', padding: '8px 20px', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 700 }}>Почати</div>}
                                                    {isLocked && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 }}>
                                                            <span>🔒</span> {lesson.unlocks_at ? formatTimeLeft(lesson.unlocks_at) : 'Заблоковано'}
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
                    <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Навчання</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)', cursor: 'pointer' }}
                            onClick={() => navigate('/dictionary')}>
                            <div style={{ width: 56, height: 56, background: '#dbeafe', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>📖</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Мій Словник</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Усі вивчені слова</p>
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.02)', cursor: 'pointer' }}
                            onClick={() => navigate('/flashcards')}>
                            <div style={{ width: 56, height: 56, background: '#fef3c7', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🃏</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Флеш-картки</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Тренуй лексику</p>
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
