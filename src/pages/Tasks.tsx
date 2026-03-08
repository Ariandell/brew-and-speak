import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';
import { Card } from '../components/ui/Card';
import { useUserId } from '../components/TelegramProvider';

const Tasks: React.FC = () => {
    const navigate = useNavigate();
    const [path, setPath] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [stats, setStats] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const USER_ID = useUserId();

    useEffect(() => {
        // Fetch enrollment, path, and stats concurrently
        Promise.all([
            fetch(`/api/users/${USER_ID}/enrollment`).then(res => res.json()),
            fetch(`/api/users/${USER_ID}/stats`).then(res => res.json())
        ])
            .then(([userData, statsData]) => {
                setStats(statsData);
                if (userData.courseId) {
                    return fetch(`/api/courses/${userData.courseId}/path/${USER_ID}`);
                }
                throw new Error("No enrolled course");
            })
            .then(res => res.json())
            .then(data => {
                setPath(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load schedule", err);
                setLoading(false);
            });
    }, []);

    // Helper to format date "YYYY-MM-DD"
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const isSameDay = (d1: Date, d2: Date) => formatDate(d1) === formatDate(d2);

    // Group lessons by date
    const lessonsByDate = useMemo(() => {
        const map = new Map<string, any[]>();
        const todayStr = formatDate(new Date());

        path.forEach((lesson, index) => {
            let targetDateStr: string | null = null;

            if (lesson.status === 'completed' && lesson.completed_at) {
                targetDateStr = formatDate(new Date(lesson.completed_at + 'Z'));
            } else if (lesson.status === 'unlocked') {
                targetDateStr = todayStr; // The active lesson belongs to today
            } else if (lesson.status === 'locked' && lesson.unlocks_at) {
                targetDateStr = formatDate(new Date(lesson.unlocks_at + 'Z'));
            }

            if (targetDateStr) {
                if (!map.has(targetDateStr)) map.set(targetDateStr, []);
                map.get(targetDateStr)!.push({ ...lesson, displayIndex: index + 1 });
            }
        });
        return map;
    }, [path]);

    // Build the week calendar (Monday to Sunday)
    const weekDays = useMemo(() => {
        const today = new Date();
        const currentDayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0 = Mon
        const monday = new Date(today);
        monday.setDate(today.getDate() - currentDayOfWeek);

        return Array.from({ length: 7 }).map((_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return date;
        });
    }, []);

    const dayNames = ['Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    const monthNames = ['Січня', 'Лютого', 'Березня', 'Квітня', 'Травня', 'Червня', 'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня'];

    // Auto-center the horizontal calendar when it loads or date changes
    useEffect(() => {
        if (scrollRef.current) {
            // Find the selected day element inside the container
            const selectedEl = scrollRef.current.querySelector('[data-selected="true"]') as HTMLElement;
            if (selectedEl) {
                // Calculate position to center it
                const containerWidth = scrollRef.current.clientWidth;
                const elementOffset = selectedEl.offsetLeft;
                const elementWidth = selectedEl.clientWidth;

                const scrollPos = elementOffset - (containerWidth / 2) + (elementWidth / 2);
                scrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        }
    }, [selectedDate, weekDays]);

    const selectedLessons = lessonsByDate.get(formatDate(selectedDate)) || [];

    const totalCompleted = useMemo(() => path.filter(l => l.status === 'completed').length, [path]);
    const courseProgress = useMemo(() => path.length ? Math.round((totalCompleted / path.length) * 100) : 0, [path, totalCompleted]);

    const nextLessonIndex = useMemo(() => {
        return path.findIndex(l => l.status === 'unlocked' || l.status === 'locked');
    }, [path]);

    const nextLesson = nextLessonIndex >= 0 ? path[nextLessonIndex] : null;

    const formatTimeLeft = (unlocksAt: string) => {
        const now = new Date().getTime();
        const unlockTime = new Date(unlocksAt + 'Z').getTime();
        const diff = unlockTime - now;

        if (diff <= 0) return 'скоро';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `через ${hours} год`;
        return `через ${minutes} хв`;
    };

    // --- Stats Logic ---
    const currentDayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    let barHeights = [4, 4, 4, 4, 4, 4, 4];
    if (stats?.weekActivity) {
        barHeights = stats.weekActivity.map((val: number) => Math.max(4, (val / 10) * 100));
    }

    const analyticsDashboard = (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)', margin: '0.5rem 0 0.5rem 0.5rem' }}>Аналітика Курсу</h3>

            {/* Bar Chart Calendar */}
            <Card style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Оцінки</h4>
                    <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700, background: '#f5f3ff', padding: '4px 10px', borderRadius: '10px' }}>Цей тиждень</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: '140px', paddingBottom: '2rem', position: 'relative' }}>
                    {dayNames.map((day, idx) => {
                        const isToday = idx === currentDayOfWeek;
                        const isActive = stats?.weekActivity?.[idx] > 0;
                        const height = barHeights[idx];
                        const activityScore = stats?.weekActivity?.[idx] || 0;

                        return (
                            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '0.5rem', position: 'relative' }}>
                                <div style={{
                                    width: '100%',
                                    height: `${height}%`,
                                    background: isToday ? 'linear-gradient(to top, #4f46e5, #7c3aed)' : (isActive ? '#c4b5fd' : '#f1f5f9'),
                                    borderRadius: '8px',
                                    transition: 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    position: 'relative',
                                    boxShadow: isToday ? '0 4px 8px rgba(124, 58, 237, 0.2)' : 'none'
                                }} >
                                    {isToday && activityScore > 0 && (
                                        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%, -10px)', zIndex: 10 }}>
                                            <div className="animate-pop" style={{
                                                background: '#1e293b', color: 'white', fontSize: '0.75rem', fontWeight: 800,
                                                padding: '4px 8px', borderRadius: '8px', whiteSpace: 'nowrap',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                            }}>
                                                {activityScore}/10
                                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid #1e293b' }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: '0.7rem', color: isToday ? '#7c3aed' : '#94a3b8', fontWeight: isToday ? 800 : 600,
                                    marginTop: 'auto'
                                }}>{day}</span>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Detailed Progress Card */}
            <Card style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                    <div>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Прогрес</p>
                        <h4 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>{courseProgress}%</h4>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 4px' }}>Уроків пройдено</p>
                        <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>{totalCompleted} <span style={{ color: '#cbd5e1', fontSize: '1rem' }}>/ {path.length}</span></h4>
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: '8px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${courseProgress}%`, backgroundColor: '#10b981', transition: 'width 1s ease-out' }} />
                </div>
            </Card>

            {/* Two Column Mini Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Card style={{ padding: '1.25rem', backgroundColor: '#f5f3ff', borderRadius: '20px', border: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ width: 32, height: 32, backgroundColor: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontSize: '1.2rem' }}>🔥</div>
                    <div>
                        <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4c1d95', margin: 0, fontFamily: 'var(--font-display)' }}>{stats ? stats.streak : '-'} дні</h4>
                        <p style={{ fontSize: '0.8rem', color: '#6d28d9', margin: 0, fontWeight: 600 }}>Ударний режим</p>
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem', backgroundColor: '#ecfdf5', borderRadius: '20px', border: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ width: 32, height: 32, backgroundColor: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '1.2rem' }}>⏱️</div>
                    <div>
                        <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46', margin: 0, fontFamily: 'var(--font-display)' }}>{stats ? stats.totalTime : '-'}</h4>
                        <p style={{ fontSize: '0.8rem', color: '#059669', margin: 0, fontWeight: 600 }}>Час у додатку</p>
                        {stats?.flashcardTime && (
                            <p style={{ fontSize: '0.7rem', color: '#6ee7b7', margin: '2px 0 0', fontWeight: 600 }}>🃏 З них картки: {stats.flashcardTime}</p>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f6', paddingBottom: '100px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header / Hero with Purple Background */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                padding: '1.5rem 1.5rem 4rem',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                boxShadow: '0 10px 30px rgba(124, 58, 237, 0.2)',
                position: 'relative',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{ width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <button onClick={() => navigate('/')} style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: 44, height: 44, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-2px' }}>
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Розклад</h1>
                </div>
            </div>

            {/* Main Content Area pulled up over the hero */}
            <div className="animate-fade-in" style={{ padding: '0 1.2rem', marginTop: '-2.5rem', position: 'relative', zIndex: 10 }}>

                {/* Date Header Card */}
                <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                            {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
                        </h2>
                        {/* Premium Streak Badge instead of a standard emoji */}
                        <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(to right, #fff1f2, #ffe4e6)', padding: '6px 12px', borderRadius: '14px', border: '1px solid #fecdd3' }}>
                            <span style={{ fontSize: '1.1rem' }}>🔥</span>
                            <span style={{ color: '#e11d48', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.5px' }}>{stats ? stats.streak : '-'} дні</span>
                        </div>
                    </div>

                    {/* Calendar Slider */}
                    <div ref={scrollRef} style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem', margin: '0 -1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}>
                        {weekDays.map((date, idx) => {
                            const isSelected = isSameDay(date, selectedDate);
                            const isToday = isSameDay(date, new Date());
                            const dayDateStr = formatDate(date);
                            const dayLessons = lessonsByDate.get(dayDateStr) || [];
                            const hasLesson = dayLessons.length > 0;
                            const isCompleted = dayLessons.some(l => l.status === 'completed');

                            let bgColor = 'white';
                            let textColor = '#1e293b';

                            if (hasLesson) {
                                bgColor = isCompleted ? '#10b981' : '#f43f5e';
                                textColor = 'white';
                            } else if (isSelected) {
                                bgColor = '#7c3aed';
                                textColor = 'white';
                            }

                            return (
                                <div
                                    key={idx}
                                    data-selected={isSelected}
                                    onClick={() => setSelectedDate(date)}
                                    style={{
                                        minWidth: '64px', padding: '1rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                                        borderRadius: '20px', cursor: 'pointer',
                                        backgroundColor: bgColor,
                                        color: textColor,
                                        border: isToday && !isSelected ? '2px solid #7c3aed' : (isSelected ? '2px solid #1e293b' : '2px solid transparent'),
                                        boxShadow: isSelected ? '0 12px 24px rgba(0,0,0,0.15)' : '0 4px 10px rgba(0,0,0,0.02)',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        position: 'relative', transform: isSelected ? 'translateY(-2px)' : 'none'
                                    }}
                                >
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, opacity: isSelected || hasLesson ? 0.9 : 0.5 }}>{dayNames[idx]}</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{date.getDate()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Timeline */}
                <div style={{ position: 'relative', marginTop: '1.5rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontWeight: 600 }}>Завантаження розкладу...</div>
                    ) : (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {nextLesson && (
                                <div className="animate-fade-in" style={{ animationDelay: '0.2s', marginTop: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Наступний урок</h3>
                                    <Card
                                        onClick={() => nextLesson.status === 'unlocked' && navigate(`/lesson/${nextLesson.id}`)}
                                        style={{
                                            backgroundColor: 'white',
                                            border: 'none', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
                                            boxShadow: '0 8px 25px rgba(0,0,0,0.04)', borderRadius: '20px',
                                            cursor: nextLesson.status === 'locked' ? 'default' : 'pointer',
                                            opacity: nextLesson.status === 'locked' ? 0.8 : 1, position: 'relative', overflow: 'hidden'
                                        }}>
                                        {nextLesson.status === 'unlocked' && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#7c3aed' }} />}

                                        <div style={{ width: 48, height: 48, background: nextLesson.status === 'locked' ? '#f1f5f9' : '#f5f3ff', color: nextLesson.status === 'locked' ? '#94a3b8' : '#7c3aed', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                                            {nextLesson.status === 'locked' ? '🔒' : '▶'}
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {nextLesson.status === 'locked' && nextLesson.unlocks_at ? `Відкриється ${formatTimeLeft(nextLesson.unlocks_at)}` : `Урок ${nextLessonIndex + 1}`}
                                            </p>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a', fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>{nextLesson.title}</h3>
                                        </div>
                                    </Card>
                                </div>
                            )}

                            {analyticsDashboard}
                        </div>
                    )}
                </div>
            </div>
            <BottomNav />
        </div >
    );
};

export default Tasks;
