import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';
import { useTelegram, useUserId, useIsAdmin } from '../components/TelegramProvider';

const API = '';

interface UserStats {
    streak: number;
    totalTime: string;
    lessonsCompleted: number;
    totalLessons: number;
    wordsLearned: number;
    wordsTotal: number;
    flashcardSessions: number;
    flashcardTime: string;
    correctAnswers: number;
    wrongAnswers: number;
    hasCompletedLessonWords: boolean;
    hadPerfectSession: boolean;
}

// ===== ACHIEVEMENTS DEFINITIONS =====
interface Achievement {
    id: string;
    emoji: string;
    title: string;
    description: string;
    category: 'lessons' | 'words' | 'streak' | 'flashcards' | 'time' | 'special';
    check: (s: UserStats) => boolean;
    progress: (s: UserStats) => number; // 0..1
    progressLabel: (s: UserStats) => string;
}

const ACHIEVEMENTS: Achievement[] = [
    // === LESSON ACHIEVEMENTS ===
    {
        id: 'first_lesson', emoji: '🎓', title: 'Перший крок', description: 'Пройди перший урок', category: 'lessons',
        check: s => s.lessonsCompleted >= 1, progress: s => Math.min(s.lessonsCompleted / 1, 1), progressLabel: s => `${s.lessonsCompleted}/1`
    },
    {
        id: 'lessons_5', emoji: '📚', title: 'Учень', description: 'Пройди 5 уроків', category: 'lessons',
        check: s => s.lessonsCompleted >= 5, progress: s => Math.min(s.lessonsCompleted / 5, 1), progressLabel: s => `${s.lessonsCompleted}/5`
    },
    {
        id: 'lessons_10', emoji: '🏫', title: 'Студент', description: 'Пройди 10 уроків', category: 'lessons',
        check: s => s.lessonsCompleted >= 10, progress: s => Math.min(s.lessonsCompleted / 10, 1), progressLabel: s => `${s.lessonsCompleted}/10`
    },
    {
        id: 'lessons_25', emoji: '🎯', title: 'Відмінник', description: 'Пройди 25 уроків', category: 'lessons',
        check: s => s.lessonsCompleted >= 25, progress: s => Math.min(s.lessonsCompleted / 25, 1), progressLabel: s => `${s.lessonsCompleted}/25`
    },
    {
        id: 'course_done', emoji: '🏆', title: 'Випускник', description: 'Заверши весь курс', category: 'lessons',
        check: s => s.totalLessons > 0 && s.lessonsCompleted >= s.totalLessons, progress: s => s.totalLessons > 0 ? Math.min(s.lessonsCompleted / s.totalLessons, 1) : 0, progressLabel: s => `${s.lessonsCompleted}/${s.totalLessons}`
    },

    // === WORD ACHIEVEMENTS ===
    {
        id: 'words_10', emoji: '📖', title: 'Перші слова', description: 'Вивчи 10 слів', category: 'words',
        check: s => s.wordsLearned >= 10, progress: s => Math.min(s.wordsLearned / 10, 1), progressLabel: s => `${s.wordsLearned}/10`
    },
    {
        id: 'words_25', emoji: '📝', title: 'Словник росте', description: 'Вивчи 25 слів', category: 'words',
        check: s => s.wordsLearned >= 25, progress: s => Math.min(s.wordsLearned / 25, 1), progressLabel: s => `${s.wordsLearned}/25`
    },
    {
        id: 'words_50', emoji: '🧠', title: 'Ерудит', description: 'Вивчи 50 слів', category: 'words',
        check: s => s.wordsLearned >= 50, progress: s => Math.min(s.wordsLearned / 50, 1), progressLabel: s => `${s.wordsLearned}/50`
    },
    {
        id: 'words_100', emoji: '🌟', title: 'Словників', description: 'Вивчи 100 слів', category: 'words',
        check: s => s.wordsLearned >= 100, progress: s => Math.min(s.wordsLearned / 100, 1), progressLabel: s => `${s.wordsLearned}/100`
    },
    {
        id: 'words_200', emoji: '💎', title: 'Лексикон', description: 'Вивчи 200 слів', category: 'words',
        check: s => s.wordsLearned >= 200, progress: s => Math.min(s.wordsLearned / 200, 1), progressLabel: s => `${s.wordsLearned}/200`
    },

    // === STREAK ACHIEVEMENTS ===
    {
        id: 'streak_3', emoji: '🔥', title: 'На розгоні', description: '3 дні підряд', category: 'streak',
        check: s => s.streak >= 3, progress: s => Math.min(s.streak / 3, 1), progressLabel: s => `${s.streak}/3`
    },
    {
        id: 'streak_7', emoji: '⚡', title: 'Тижнева звичка', description: '7 днів підряд', category: 'streak',
        check: s => s.streak >= 7, progress: s => Math.min(s.streak / 7, 1), progressLabel: s => `${s.streak}/7`
    },
    {
        id: 'streak_14', emoji: '💪', title: 'Двотижневий марафон', description: '14 днів підряд', category: 'streak',
        check: s => s.streak >= 14, progress: s => Math.min(s.streak / 14, 1), progressLabel: s => `${s.streak}/14`
    },
    {
        id: 'streak_30', emoji: '🐉', title: 'Легенда', description: '30 днів підряд', category: 'streak',
        check: s => s.streak >= 30, progress: s => Math.min(s.streak / 30, 1), progressLabel: s => `${s.streak}/30`
    },

    // === FLASHCARD ACHIEVEMENTS ===
    {
        id: 'fc_first', emoji: '🃏', title: 'Перша картка', description: 'Пройди першу сесію карток', category: 'flashcards',
        check: s => s.flashcardSessions >= 1, progress: s => Math.min(s.flashcardSessions / 1, 1), progressLabel: s => `${s.flashcardSessions}/1`
    },
    {
        id: 'fc_10', emoji: '🎴', title: 'Картковий гравець', description: 'Пройди 10 сесій карток', category: 'flashcards',
        check: s => s.flashcardSessions >= 10, progress: s => Math.min(s.flashcardSessions / 10, 1), progressLabel: s => `${s.flashcardSessions}/10`
    },
    {
        id: 'fc_50', emoji: '🏅', title: 'Майстер карток', description: 'Пройди 50 сесій карток', category: 'flashcards',
        check: s => s.flashcardSessions >= 50, progress: s => Math.min(s.flashcardSessions / 50, 1), progressLabel: s => `${s.flashcardSessions}/50`
    },
    {
        id: 'accuracy_80', emoji: '🎯', title: 'Снайпер', description: '80%+ правильних відповідей', category: 'flashcards',
        check: s => (s.correctAnswers + s.wrongAnswers) > 10 && (s.correctAnswers / (s.correctAnswers + s.wrongAnswers)) >= 0.8,
        progress: s => { const total = s.correctAnswers + s.wrongAnswers; return total > 0 ? Math.min((s.correctAnswers / total) / 0.8, 1) : 0; },
        progressLabel: s => { const total = s.correctAnswers + s.wrongAnswers; return total > 0 ? `${Math.round((s.correctAnswers / total) * 100)}%` : '0%'; }
    },

    // === SPECIAL ===
    {
        id: 'all_words_lesson', emoji: '✨', title: 'Повний урок', description: 'Вивчи всі слова одного уроку', category: 'special',
        check: s => s.hasCompletedLessonWords, progress: s => s.hasCompletedLessonWords ? 1 : 0, progressLabel: s => s.hasCompletedLessonWords ? '1/1' : '0/1'
    },
    {
        id: 'perfect_session', emoji: '💯', title: 'Ідеальна сесія', description: '100% правильних в одній сесії', category: 'special',
        check: s => s.hadPerfectSession, progress: s => s.hadPerfectSession ? 1 : 0, progressLabel: s => s.hadPerfectSession ? '1/1' : '0/1'
    },
];

const categoryLabels: Record<string, string> = {
    lessons: '📚 Уроки',
    words: '📖 Слова',
    streak: '🔥 Серія',
    flashcards: '🃏 Картки',
    time: '⏱️ Час',
    special: '✨ Особливі',
};

const Profile: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useTelegram();
    const USER_ID = useUserId();
    const isAdmin = useIsAdmin();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAllAchievements, setShowAllAchievements] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch(`${API}/api/users/${USER_ID}/stats`).then(r => r.json()).catch(() => ({})),
            fetch(`${API}/api/users/${USER_ID}/dictionary`).then(r => r.json()).catch(() => []),
        ]).then(([statsData, dictData]) => {
            const words = Array.isArray(dictData) ? dictData : [];
            const wordsLearned = words.filter((w: any) => w.times_shown > 0 && (w.times_correct / w.times_shown) >= 0.8).length;
            const correctAnswers = words.reduce((sum: number, w: any) => sum + (w.times_correct || 0), 0);
            const wrongAnswers = words.reduce((sum: number, w: any) => sum + (w.times_wrong || 0), 0);

            // Check if all words from any lesson are mastered
            const lessonGroups: Record<string, any[]> = {};
            words.forEach((w: any) => {
                if (!lessonGroups[w.lesson_title]) lessonGroups[w.lesson_title] = [];
                lessonGroups[w.lesson_title].push(w);
            });
            const hasCompletedLessonWords = Object.values(lessonGroups).some(group =>
                group.length > 0 && group.every((w: any) => w.times_shown > 0 && (w.times_correct / w.times_shown) >= 0.8)
            );

            // Check localStorage for perfect session flag
            const hadPerfectSession = localStorage.getItem('achievement_perfect_session') === 'true';

            setStats({
                streak: statsData.streak || 0,
                totalTime: statsData.totalTime || '0 хв',
                lessonsCompleted: statsData.lessonsCompleted || 0,
                totalLessons: statsData.totalLessons || 0,
                wordsLearned,
                wordsTotal: words.length,
                flashcardSessions: statsData.flashcardSessions || 0,
                flashcardTime: statsData.flashcardTime || '0 хв',
                correctAnswers,
                wrongAnswers,
                hasCompletedLessonWords,
                hadPerfectSession,
            });
            setLoading(false);
        });
    }, []);

    const earnedCount = stats ? ACHIEVEMENTS.filter(a => a.check(stats)).length : 0;

    // Group achievements by category
    const grouped = ACHIEVEMENTS.reduce((acc, a) => {
        if (!acc[a.category]) acc[a.category] = [];
        acc[a.category].push(a);
        return acc;
    }, {} as Record<string, Achievement[]>);

    const categoryOrder = ['lessons', 'words', 'streak', 'flashcards', 'special'];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f6', paddingBottom: '100px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                padding: '1.5rem 1.5rem 5rem',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                boxShadow: '0 10px 30px rgba(124, 58, 237, 0.25)',
                color: 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                    <button onClick={() => navigate('/')} style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: 44, height: 44, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Профіль</h1>
                </div>

                {/* Avatar */}
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', fontSize: '2rem', overflow: 'hidden' }}>
                    {user?.photo_url ? (
                        <img src={user.photo_url} alt="User Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        '👤'
                    )}
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.25rem', fontFamily: 'var(--font-display)' }}>
                    {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Студент'}
                </h2>
                <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0 }}>Березень 2026</p>
            </div>

            {/* Content */}
            <div style={{ padding: '0 1.2rem', marginTop: '-3rem', position: 'relative', zIndex: 10 }}>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed', fontFamily: 'var(--font-display)' }}>{stats?.streak || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>🔥 Днів підряд</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-display)' }}>{stats?.lessonsCompleted || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>📚 Уроків пройдено</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-display)' }}>{stats?.wordsLearned || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>📖 Слів вивчено</div>
                    </div>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'var(--font-display)' }}>{stats?.totalTime || '0'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>⏱️ Час у додатку</div>
                    </div>
                </div>

                {/* Admin Access Button */}
                {isAdmin && (
                    <button
                        onClick={() => navigate('/admin')}
                        style={{
                            width: '100%',
                            padding: '1.1rem',
                            borderRadius: '20px',
                            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                            color: 'white',
                            border: 'none',
                            fontSize: '1.05rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            marginBottom: '1.5rem',
                            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.2)'
                        }}
                    >
                        <span style={{ fontSize: '1.3rem' }}>⚙️</span> Панель адміністратора
                    </button>
                )}

                {/* Achievements Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        🏅 Досягнення
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginLeft: '8px' }}>{earnedCount}/{ACHIEVEMENTS.length}</span>
                    </h3>
                    <button onClick={() => setShowAllAchievements(!showAllAchievements)} style={{ background: '#f5f3ff', color: '#7c3aed', border: 'none', borderRadius: '10px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {showAllAchievements ? 'Згорнути' : 'Показати всі'}
                    </button>
                </div>

                {/* Earned achievements row (collapsed mode) */}
                {!showAllAchievements && stats && (
                    <>
                        {/* Earned */}
                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem', scrollbarWidth: 'none' }}>
                            {ACHIEVEMENTS.filter(a => a.check(stats)).map(a => (
                                <div key={a.id} style={{ minWidth: 72, textAlign: 'center', background: 'white', borderRadius: '16px', padding: '0.75rem 0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                                    <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>{a.emoji}</div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{a.title}</div>
                                </div>
                            ))}
                            {earnedCount === 0 && (
                                <div style={{ textAlign: 'center', width: '100%', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                    Ще немає досягнень. Почніть навчання! 🚀
                                </div>
                            )}
                        </div>
                        {/* Next 3 locked achievements preview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {ACHIEVEMENTS.filter(a => !a.check(stats)).slice(0, 3).map(a => {
                                const prog = a.progress(stats);
                                return (
                                    <div key={a.id} style={{ background: 'white', borderRadius: '16px', padding: '0.85rem 1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontSize: '1.4rem', opacity: 0.35, width: 36, textAlign: 'center' }}>{a.emoji}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#94a3b8' }}>{a.title}</div>
                                            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                                                <div style={{ width: `${prog * 100}%`, height: '100%', background: '#c4b5fd', borderRadius: 2, transition: 'width 0.5s' }} />
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#c4b5fd' }}>{a.progressLabel(stats)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Full achievements list (expanded mode) */}
                {showAllAchievements && stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {categoryOrder.map(cat => {
                            const items = grouped[cat];
                            if (!items) return null;
                            return (
                                <div key={cat}>
                                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.75rem 0.25rem' }}>
                                        {categoryLabels[cat]}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {items.map(a => {
                                            const earned = a.check(stats);
                                            const prog = a.progress(stats);
                                            return (
                                                <div key={a.id} style={{
                                                    background: earned ? 'linear-gradient(135deg, #faf5ff, #f5f3ff)' : 'white',
                                                    borderRadius: '16px', padding: '1rem 1.1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    border: earned ? '1px solid #c4b5fd' : '1px solid transparent',
                                                }}>
                                                    <div style={{
                                                        width: 44, height: 44, borderRadius: '14px',
                                                        background: earned ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : '#f1f5f9',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '1.3rem', flexShrink: 0,
                                                        filter: earned ? 'none' : 'grayscale(1)',
                                                        opacity: earned ? 1 : 0.4,
                                                    }}>
                                                        {a.emoji}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: earned ? '#1e293b' : '#94a3b8', marginBottom: '2px' }}>{a.title}</div>
                                                        <div style={{ fontSize: '0.75rem', color: earned ? '#7c3aed' : '#cbd5e1', fontWeight: 500 }}>{a.description}</div>
                                                        {!earned && (
                                                            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                                                                <div style={{ width: `${prog * 100}%`, height: '100%', background: 'linear-gradient(90deg, #c4b5fd, #a78bfa)', borderRadius: 2 }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: earned ? '#10b981' : '#cbd5e1', flexShrink: 0 }}>
                                                        {earned ? '✓' : a.progressLabel(stats)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <BottomNav />
        </div>
    );
};

export default Profile;
