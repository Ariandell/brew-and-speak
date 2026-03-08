import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';
import { useUserId } from '../components/TelegramProvider';

const API = '';

interface StudyCard {
    id: number;
    front: string;
    back: string;
    lesson_title: string;
    times_shown: number;
    times_correct: number;
    times_wrong: number;
}

const Flashcards: React.FC = () => {
    const navigate = useNavigate();
    const [cards, setCards] = useState<StudyCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0 });
    const [finished, setFinished] = useState(false);

    // Swipe state
    const [dragX, setDragX] = useState(0);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [flyOut, setFlyOut] = useState<'left' | 'right' | null>(null);
    const startPos = useRef({ x: 0, y: 0 });
    const USER_ID = useUserId();

    const loadCards = useCallback(() => {
        setLoading(true);
        fetch(`${API}/api/users/${USER_ID}/flashcards/study`)
            .then(r => r.json())
            .then(data => {
                setCards(Array.isArray(data) ? data : []);
                setCurrentIndex(0);
                setFlipped(false);
                setFinished(false);
                setSessionStats({ correct: 0, wrong: 0 });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => { loadCards(); }, [loadCards]);

    useEffect(() => {
        if (finished && cards.length > 0 && sessionStats.correct === cards.length && sessionStats.wrong === 0) {
            localStorage.setItem('achievement_perfect_session', 'true');
        }
    }, [finished, sessionStats, cards.length]);

    const submitAnswer = useCallback(async (correct: boolean) => {
        const card = cards[currentIndex];
        if (!card) return;
        setSessionStats(prev => ({
            correct: prev.correct + (correct ? 1 : 0),
            wrong: prev.wrong + (correct ? 0 : 1)
        }));
        try {
            await fetch(`${API}/api/users/${USER_ID}/flashcards/${card.id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correct })
            });
        } catch { }
    }, [cards, currentIndex]);

    const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
        const correct = direction === 'right';
        setFlyOut(direction);
        submitAnswer(correct);
        setTimeout(() => {
            setFlyOut(null);
            setDragX(0);
            setDragY(0);
            setFlipped(false);
            if (currentIndex + 1 >= cards.length) {
                setFinished(true);
            } else {
                setCurrentIndex(prev => prev + 1);
            }
        }, 300);
    }, [currentIndex, cards.length, submitAnswer]);

    // Touch handlers
    const onTouchStart = (e: React.TouchEvent) => {
        startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsDragging(true);
    };
    const onTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        setDragX(e.touches[0].clientX - startPos.current.x);
        setDragY((e.touches[0].clientY - startPos.current.y) * 0.3);
    };
    const onTouchEnd = () => {
        setIsDragging(false);
        if (Math.abs(dragX) > 100) {
            handleSwipeComplete(dragX > 0 ? 'right' : 'left');
        } else { setDragX(0); setDragY(0); }
    };

    // Mouse handlers
    const onMouseDown = (e: React.MouseEvent) => {
        startPos.current = { x: e.clientX, y: e.clientY };
        setIsDragging(true);
        e.preventDefault();
    };
    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => {
            setDragX(e.clientX - startPos.current.x);
            setDragY((e.clientY - startPos.current.y) * 0.3);
        };
        const onUp = () => {
            setIsDragging(false);
            if (Math.abs(dragX) > 100) {
                handleSwipeComplete(dragX > 0 ? 'right' : 'left');
            } else { setDragX(0); setDragY(0); }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [isDragging, dragX, handleSwipeComplete]);

    const card = cards[currentIndex];
    const totalAnswered = sessionStats.correct + sessionStats.wrong;
    const rotation = dragX * 0.12;
    const swipeOpacity = Math.min(Math.abs(dragX) / 120, 1);

    const getCardTransform = () => {
        if (flyOut === 'left') return 'translateX(-120vw) rotate(-30deg)';
        if (flyOut === 'right') return 'translateX(120vw) rotate(30deg)';
        return `translateX(${dragX}px) translateY(${dragY}px) rotate(${rotation}deg)`;
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f6', paddingBottom: '100px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                padding: '1.5rem 1.5rem 3rem',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                boxShadow: '0 10px 30px rgba(239, 68, 68, 0.2)',
                color: 'white',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: 44, height: 44, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Вивчення слів</h1>
                    <div style={{ width: 44 }} />
                </div>
                {cards.length > 0 && !finished && (
                    <p style={{ fontSize: '0.85rem', opacity: 0.85, margin: 0, textAlign: 'center' }}>{currentIndex + 1} / {cards.length}</p>
                )}
                {/* Progress bar */}
                {cards.length > 0 && !finished && (
                    <div style={{ marginTop: '0.75rem', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${(currentIndex / cards.length) * 100}%`,
                            height: '100%',
                            background: 'white',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                )}
            </div>

            {/* Content */}
            <div style={{ padding: '0 1.2rem', marginTop: '-1.5rem', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '5rem 0', color: '#94a3b8', fontWeight: 600 }}>Завантаження...</div>
                ) : cards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 2rem', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', width: '100%', maxWidth: 400 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                        <h3 style={{ fontFamily: 'var(--font-display)', color: '#1e293b', fontWeight: 800, margin: '0 0 0.5rem' }}>Все вивчено!</h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>Немає карток для повторення.<br />Поверніться пізніше!</p>
                        <button onClick={() => navigate('/')} style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>
                            На головну
                        </button>
                    </div>
                ) : finished ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 2rem', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', width: '100%', maxWidth: 400 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
                        <h3 style={{ fontFamily: 'var(--font-display)', color: '#1e293b', fontWeight: 800, margin: '0 0 1rem', fontSize: '1.3rem' }}>Сесію завершено!</h3>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ background: '#ecfdf5', padding: '1rem 1.5rem', borderRadius: '16px', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-display)' }}>{sessionStats.correct}</div>
                                <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>Знаю ✓</div>
                            </div>
                            <div style={{ background: '#fef2f2', padding: '1rem 1.5rem', borderRadius: '16px', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-display)' }}>{sessionStats.wrong}</div>
                                <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>Не знаю ✕</div>
                            </div>
                        </div>
                        {totalAnswered > 0 && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(sessionStats.correct / totalAnswered) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '4px' }} />
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>{Math.round((sessionStats.correct / totalAnswered) * 100)}% правильно</p>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button onClick={() => loadCards()} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>🔄 Ще раз</button>
                            <button onClick={() => navigate('/')} style={{ padding: '12px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>На головну</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* SWIPEABLE CARD */}
                        <div style={{ position: 'relative', width: '100%', maxWidth: 380, height: 320, marginBottom: '1.5rem', perspective: '1200px' }}>
                            {/* Swipe feedback overlays */}
                            <div style={{
                                position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                                opacity: dragX < -20 ? swipeOpacity : 0,
                                transition: isDragging ? 'none' : 'opacity 0.2s',
                                pointerEvents: 'none', zIndex: 10,
                                background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%',
                                width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid rgba(239, 68, 68, 0.4)',
                            }}>
                                <span style={{ fontSize: '1.4rem', color: '#ef4444' }}>✕</span>
                            </div>
                            <div style={{
                                position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                                opacity: dragX > 20 ? swipeOpacity : 0,
                                transition: isDragging ? 'none' : 'opacity 0.2s',
                                pointerEvents: 'none', zIndex: 10,
                                background: 'rgba(16, 185, 129, 0.15)', borderRadius: '50%',
                                width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid rgba(16, 185, 129, 0.4)',
                            }}>
                                <span style={{ fontSize: '1.4rem', color: '#10b981' }}>✓</span>
                            </div>

                            {/* Card */}
                            <div
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                                onMouseDown={onMouseDown}
                                onClick={(e) => { if (Math.abs(dragX) < 5) { e.stopPropagation(); setFlipped(f => !f); } }}
                                style={{
                                    position: 'absolute', inset: 0, zIndex: 5,
                                    transform: getCardTransform(),
                                    transition: (isDragging || flyOut) ? (flyOut ? 'transform 0.3s ease-out' : 'none') : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    userSelect: 'none',
                                    touchAction: 'none',
                                    transformStyle: 'preserve-3d',
                                }}
                            >
                                {/* FRONT */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden',
                                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: 'white',
                                    borderRadius: '24px',
                                    boxShadow: dragX > 20
                                        ? `0 15px 40px rgba(16, 185, 129, ${0.1 + swipeOpacity * 0.2}), 0 0 0 3px rgba(16, 185, 129, ${swipeOpacity * 0.6})`
                                        : dragX < -20
                                            ? `0 15px 40px rgba(239, 68, 68, ${0.1 + swipeOpacity * 0.2}), 0 0 0 3px rgba(239, 68, 68, ${swipeOpacity * 0.6})`
                                            : '0 10px 40px rgba(0,0,0,0.08)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    padding: '2rem',
                                }}>
                                    {card && card.times_shown > 0 && (
                                        <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, background: '#f1f5f9', padding: '3px 8px', borderRadius: '8px' }}>
                                            {card.times_correct}✓ · {card.times_wrong}✕
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '1rem' }}>СЛОВО</p>
                                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: 0, textAlign: 'center' }}>{card?.front}</h2>
                                    <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '2rem' }}>Натисніть щоб перевернути</p>
                                    <p style={{ position: 'absolute', bottom: '14px', fontSize: '0.7rem', color: '#e2e8f0' }}>{card?.lesson_title}</p>
                                </div>

                                {/* BACK */}
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    backfaceVisibility: 'hidden',
                                    WebkitBackfaceVisibility: 'hidden',
                                    transform: flipped ? 'rotateY(0deg)' : 'rotateY(-180deg)',
                                    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: 'linear-gradient(145deg, #f59e0b 0%, #ef4444 100%)',
                                    borderRadius: '24px',
                                    boxShadow: '0 15px 40px rgba(239, 68, 68, 0.25)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    padding: '2rem', color: 'white',
                                }}>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '0.5rem' }}>ПЕРЕКЛАД</p>
                                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: 0, textAlign: 'center' }}>{card?.back}</h2>
                                    <div style={{ marginTop: '2rem', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.78rem', opacity: 0.7 }}>
                                        <span>← Не знаю</span>
                                        <span style={{ opacity: 0.4 }}>|</span>
                                        <span>Знаю →</span>
                                    </div>
                                    <p style={{ position: 'absolute', bottom: '14px', fontSize: '0.7rem', opacity: 0.5 }}>{card?.lesson_title}</p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.5rem' }}>
                            <button
                                onClick={() => { setFlipped(true); setTimeout(() => handleSwipeComplete('left'), 200); }}
                                style={{
                                    width: 60, height: 60, borderRadius: '50%',
                                    background: '#fef2f2', border: '2px solid #fecaca',
                                    color: '#ef4444', fontSize: '1.4rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(239,68,68,0.1)',
                                }}
                            >✕</button>

                            <button
                                onClick={() => setFlipped(f => !f)}
                                style={{
                                    width: 46, height: 46, borderRadius: '50%',
                                    background: '#f8fafc', border: '2px solid #e2e8f0',
                                    color: '#94a3b8', fontSize: '1.1rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s',
                                }}
                            >↻</button>

                            <button
                                onClick={() => { setFlipped(true); setTimeout(() => handleSwipeComplete('right'), 200); }}
                                style={{
                                    width: 60, height: 60, borderRadius: '50%',
                                    background: '#ecfdf5', border: '2px solid #a7f3d0',
                                    color: '#10b981', fontSize: '1.4rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16,185,129,0.1)',
                                }}
                            >✓</button>
                        </div>

                        {/* Session mini-stats */}
                        {totalAnswered > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1.2rem' }}>
                                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>✓ {sessionStats.correct}</span>
                                <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700 }}>✕ {sessionStats.wrong}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
            <BottomNav />
        </div>
    );
};

export default Flashcards;
