import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '';

interface Stats {
    totalUsers: number;
    completedLessons: number;
    pendingHomework: number;
    activeToday: number;
    totalWordsLearned: number;
    totalFlashcards: number;
    totalSubmissions: number;
}

interface Homework {
    id: number;
    lesson_title: string;
    user_name: string;
    telegram_id: string;
    text: string;
    file_url: string;
    file_name: string;
    submitted_at: string;
    status: string;
    grade?: number;
    feedback?: string;
}

const Statistics: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats | null>(null);
    const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [selectedHW, setSelectedHW] = useState<Homework | null>(null);
    const [gradeInput, setGradeInput] = useState<string>('');
    const [feedbackInput, setFeedbackInput] = useState<string>('');
    const [submittingGrade, setSubmittingGrade] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, hwRes] = await Promise.all([
                fetch(`${API}/api/admin/statistics`),
                fetch(`${API}/api/admin/homework?status=pending`)
            ]);
            const statsData = await statsRes.json();
            const hwData = await hwRes.json();

            setStats(statsData);
            setHomeworkList(Array.isArray(hwData) ? hwData : []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleGradeSubmit = async () => {
        if (!selectedHW) return;
        setSubmittingGrade(true);
        try {
            await fetch(`${API}/api/admin/homework/${selectedHW.id}/grade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grade: gradeInput ? parseInt(gradeInput, 10) : null,
                    feedback: feedbackInput
                })
            });
            // Close modal and refresh list
            setSelectedHW(null);
            fetchDashboardData();
        } catch (error) {
            console.error('Failed to submit grade', error);
        } finally {
            setSubmittingGrade(false);
        }
    };

    const openModal = (hw: Homework) => {
        setSelectedHW(hw);
        setGradeInput(hw.grade ? hw.grade.toString() : '');
        setFeedbackInput(hw.feedback || '');
    };

    if (loading && !stats) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '90px', fontFamily: 'Inter, sans-serif' }}>
            <header style={{
                padding: '1.2rem 1.5rem',
                backgroundColor: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 20
            }}>
                <div>
                    <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', padding: 0, cursor: 'pointer', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>←</span> Назад
                    </button>
                    <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Статистика</h1>
                </div>
            </header>

            <div style={{ padding: '1.5rem' }}>
                {/* Stats Grid */}
                {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2.5rem' }}>
                        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>👨‍🎓</div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{stats.totalUsers}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Студентів</p>
                        </div>
                        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🔥</div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{stats.activeToday}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Активно сьогодні</p>
                        </div>
                        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📖</div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{stats.totalWordsLearned}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Слів у словниках</p>
                        </div>
                        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🃏</div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{stats.totalFlashcards}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Флеш-карток</p>
                        </div>
                        <div style={{ background: 'white', padding: '1.2rem', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📤</div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{stats.totalSubmissions}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Всього здано ДЗ</p>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', padding: '1.2rem', borderRadius: '20px', boxShadow: '0 8px 20px rgba(124, 58, 237, 0.2)' }}>
                            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📝</div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{stats.pendingHomework}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.9, fontWeight: 600, textTransform: 'uppercase' }}>ДЗ на перевірку</p>
                        </div>
                    </div>
                )}

                {/* Pending Homework List */}
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Очікують перевірки
                    {homeworkList.length > 0 && (
                        <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem' }}>{homeworkList.length}</span>
                    )}
                </h2>

                {homeworkList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>☕</div>
                        <p style={{ margin: 0, color: '#64748b', fontWeight: 500 }}>Усі домашні завдання перевірено!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {homeworkList.map(hw => (
                            <div key={hw.id} onClick={() => openModal(hw)} style={{
                                background: 'white', borderRadius: '20px', padding: '1.25rem',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)',
                                cursor: 'pointer', transition: 'transform 0.2s'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{hw.user_name || hw.telegram_id}</h4>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>{hw.lesson_title}</p>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {new Date(hw.submitted_at).toLocaleDateString('uk-UA')}
                                    </span>
                                </div>
                                <p style={{
                                    margin: 0, fontSize: '0.9rem', color: '#475569',
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                }}>
                                    {hw.text || (hw.file_name ? `📎 Вкладений файл: ${hw.file_name}` : 'Без тексту')}
                                </p>
                                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                    {hw.file_url && <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>Має файл</span>}
                                    {hw.status === 'graded' ? (
                                        <span style={{ background: '#d1fae5', color: '#059669', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>✓ Перевірено</span>
                                    ) : (
                                        <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>Потребує оцінки</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Grading Modal */}
            {selectedHW && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
                }} onClick={() => setSelectedHW(null)}>
                    <div style={{
                        background: 'white', borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
                        padding: '2rem 1.5rem', maxHeight: '85vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Оцінювання ДЗ</h3>
                            <button onClick={() => setSelectedHW(null)} style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: '50%', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}>×</button>
                        </div>

                        {/* Student Details */}
                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Студент</p>
                            <p style={{ margin: '2px 0 8px', fontSize: '1.05rem', fontWeight: 700 }}>{selectedHW.user_name} <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.85rem' }}>({selectedHW.telegram_id})</span></p>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Урок</p>
                            <p style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 600 }}>{selectedHW.lesson_title}</p>
                        </div>

                        {/* Homework Content */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Відповідь:</h4>
                            {selectedHW.text ? (
                                <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '16px', fontSize: '0.95rem', lineHeight: 1.5, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                                    {selectedHW.text}
                                </div>
                            ) : (
                                <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '16px', color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem' }}>
                                    Текст не додано
                                </div>
                            )}

                            {selectedHW.file_url && (
                                <a href={`${API}${selectedHW.file_url}?name=${encodeURIComponent(selectedHW.file_name)}`} download={selectedHW.file_name} target="_blank" rel="noopener noreferrer" style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', marginTop: '1rem',
                                    padding: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px',
                                    textDecoration: 'none', color: '#0f172a', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                    <div style={{ width: 40, height: 40, background: '#eff6ff', color: '#3b82f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📎</div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedHW.file_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#3b82f6' }}>Завантажити файл</div>
                                    </div>
                                </a>
                            )}
                        </div>

                        {/* Grading Form */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>Оцінка (0-100) <span style={{ color: '#94a3b8', fontWeight: 400 }}>(опціонально)</span></label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={gradeInput}
                                    onChange={e => setGradeInput(e.target.value)}
                                    placeholder="Наприклад: 95"
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'inherit' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>Коментар / Фідбек</label>
                                <textarea
                                    value={feedbackInput}
                                    onChange={e => setFeedbackInput(e.target.value)}
                                    placeholder="Напишіть коментар до роботи..."
                                    rows={4}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'inherit', resize: 'none' }}
                                />
                            </div>

                            <button
                                onClick={handleGradeSubmit}
                                disabled={submittingGrade}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
                                    background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                                    fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', transition: 'transform 0.2s',
                                    opacity: submittingGrade ? 0.7 : 1
                                }}
                            >
                                {submittingGrade ? 'Збереження...' : 'Зберегти оцінку'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Statistics;
