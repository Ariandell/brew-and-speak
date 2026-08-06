import React from 'react';
import { Mascot } from './Mascot';

// Shown when a lesson is finished. Restored from the March build, which greeted
// the student with the mascot and their score instead of dropping them back on
// the home screen with no word about how they did.

interface Props {
    totalQuestions: number;
    mistakes: number;
    timeSpent: number;
    lessonTitle: string;
    hasHomework: boolean;
    onGoHome: () => void;
    onGoHomework: () => void;
}

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m} хв ${s} сек` : `${s} сек`;
};

// Mood, wording and palette all follow from how well it went.
const verdict = (totalQuestions: number, mistakes: number, percent: number) => {
    if (totalQuestions === 0) return { mood: 'happy', title: 'Урок пройдено! ✅', note: 'Так тримати!', accent: '#10b981', tint: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' };
    if (mistakes === 0) return { mood: 'perfect', title: 'Бездоганно! 🌟', note: 'Жодної помилки – ти просто неймовірний!', accent: '#10b981', tint: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' };
    if (percent >= 70) return { mood: 'happy', title: 'Гарна робота! 💪', note: 'Ще трішки і буде ідеально!', accent: '#f59e0b', tint: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' };
    return { mood: 'sad', title: 'Не здавайся! 📚', note: 'Помилки – це частина навчання. Спробуй ще!', accent: '#ef4444', tint: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' };
};

const statLabel: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' };
const barTrack: React.CSSProperties = { height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' };

export const LessonResults: React.FC<Props> = ({ totalQuestions, mistakes, timeSpent, lessonTitle, hasHomework, onGoHome, onGoHomework }) => {
    const correct = Math.max(0, totalQuestions - mistakes);
    const percent = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
    const { mood, title, note, accent, tint } = verdict(totalQuestions, mistakes, percent);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
            <div style={{
                background: 'white', borderRadius: '28px', padding: '2rem 1.5rem', width: '100%',
                maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <Mascot mood={mood} size={100} />
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', color: '#0f172a', margin: '1rem 0 0.25rem', letterSpacing: '-0.5px' }}>{title}</h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>{note}</p>
                </div>

                {totalQuestions > 0 && (
                    <div style={{ background: tint, borderRadius: '20px', padding: '1.25rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                        {/* Ring filled to the score */}
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: `conic-gradient(${accent} ${percent * 3.6}deg, #e2e8f0 0deg)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem'
                        }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.3rem', color: accent, fontFamily: 'var(--font-display)' }}>
                                {percent}%
                            </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>{lessonTitle}</p>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {totalQuestions > 0 && (
                        <>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={statLabel}>✅ Правильних</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>{correct}/{totalQuestions}</span>
                                </div>
                                <div style={barTrack}>
                                    <div style={{ width: `${(correct / totalQuestions) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                </div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <span style={statLabel}>❌ Помилок</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444' }}>{mistakes}/{totalQuestions}</span>
                                </div>
                                <div style={barTrack}>
                                    <div style={{ width: `${(mistakes / totalQuestions) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                </div>
                            </div>
                        </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={statLabel}>⏱️ Час</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7c3aed' }}>{formatTime(timeSpent)}</span>
                    </div>
                    {totalQuestions > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={statLabel}>⭐ Бали</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>{Math.round((correct / totalQuestions) * 10)}/10</span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {hasHomework && (
                        <button onClick={onGoHomework} style={{
                            width: '100%', padding: '14px', border: 'none', borderRadius: '16px',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700,
                            boxShadow: '0 4px 14px rgba(91, 33, 182, 0.3)'
                        }}>📎 Здати домашнє завдання</button>
                    )}
                    <button onClick={onGoHome} style={{
                        width: '100%', padding: '14px', border: 'none', borderRadius: '16px',
                        background: hasHomework ? '#f1f5f9' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: hasHomework ? '#475569' : 'white', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '1rem', fontWeight: 700,
                        boxShadow: hasHomework ? 'none' : '0 4px 14px rgba(91, 33, 182, 0.3)'
                    }}>🏠 На головну</button>
                </div>
            </div>
        </div>
    );
};
