import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserId, useIsAdmin } from '../components/TelegramProvider';

const API = '';

interface Course {
    id: number;
    title: string;
    description: string;
    lesson_count: number;
}

interface CourseSelectProps {
    onEnrolled?: () => void;
    changingCourse?: boolean; // true when accessed from profile to switch course
}

const CourseSelect: React.FC<CourseSelectProps> = ({ onEnrolled, changingCourse }) => {
    const navigate = useNavigate();
    const USER_ID = useUserId();
    const isAdmin = useIsAdmin();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [enrolling, setEnrolling] = useState<number | null>(null);

    useEffect(() => {
        fetch(`${API}/api/levels`)
            .then(r => r.json())
            .then(data => setCourses(Array.isArray(data) ? data : []))
            .catch(() => setCourses([]))
            .finally(() => setLoading(false));
    }, []);

    const enroll = async (courseId: number) => {
        setEnrolling(courseId);
        try {
            await fetch(`${API}/api/users/${USER_ID}/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId })
            });
            if (onEnrolled) {
                onEnrolled();
            } else {
                navigate('/');
            }
        } catch {
            setEnrolling(null);
        }
    };

    const gradients = [
        'linear-gradient(135deg, #ede9fe, #ddd6fe)',
        'linear-gradient(135deg, #d1fae5, #a7f3d0)',
        'linear-gradient(135deg, #fef3c7, #fde68a)',
        'linear-gradient(135deg, #fee2e2, #fecaca)',
        'linear-gradient(135deg, #e0f2fe, #bae6fd)',
        'linear-gradient(135deg, #fce7f3, #fbcfe8)',
    ];
    const colors = ['#5b21b6', '#065f46', '#92400e', '#991b1b', '#0e7490', '#9d174d'];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #5b21b6, #9333ea)', padding: '3rem 1.5rem 5rem', color: 'white', textAlign: 'center' }}>
                {changingCourse && (
                    <button
                        onClick={() => navigate(-1)}
                        style={{ position: 'absolute', left: '1rem', top: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: 'white', cursor: 'pointer', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        ‹
                    </button>
                )}
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📚</div>
                <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.6rem', fontWeight: 800 }}>
                    {changingCourse ? 'Змінити курс' : 'Обери свій курс'}
                </h1>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem' }}>
                    {changingCourse ? 'Вибери інший курс для навчання' : 'Викладач підготував курси для різних рівнів'}
                </p>
                {isAdmin && courses.length > 0 && (
                    <button
                        onClick={() => navigate('/admin')}
                        style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '12px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                        ⚙️ Адмінка
                    </button>
                )}
            </div>

            <div style={{ padding: '0 1rem 100px', marginTop: '-2rem', flex: 1 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Завантаження...</div>
                ) : courses.length === 0 ? (
                    <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '2rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Курсів ще немає</p>
                        <p style={{ fontSize: '0.88rem', color: '#888', marginBottom: isAdmin ? '1.5rem' : 0 }}>Викладач ще не створив жодного курсу. Зверніться до нього у чаті!</p>

                        {isAdmin && (
                            <button
                                onClick={() => navigate('/admin')}
                                style={{
                                    width: '100%', padding: '12px', border: 'none', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                                    color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    boxShadow: '0 4px 15px rgba(15, 23, 42, 0.2)'
                                }}
                            >
                                <span style={{ fontSize: '1.2rem' }}>⚙️</span> Панель адміністратора
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {courses.map((course, idx) => (
                            <div
                                key={course.id}
                                style={{
                                    backgroundColor: 'white',
                                    borderRadius: '20px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                }}
                            >
                                {/* Color banner */}
                                <div style={{
                                    height: 8,
                                    background: gradients[idx % gradients.length]
                                }} />
                                <div style={{ padding: '1.2rem 1.2rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                        <div style={{
                                            width: 52, height: 52, borderRadius: '14px',
                                            background: gradients[idx % gradients.length],
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.6rem', flexShrink: 0
                                        }}>
                                            📖
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e' }}>{course.title}</h3>
                                            <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#888' }}>
                                                {course.lesson_count || 0} уроків
                                                {course.description ? ` · ${course.description}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => enroll(course.id)}
                                        disabled={enrolling === course.id}
                                        style={{
                                            width: '100%', padding: '12px', border: 'none',
                                            borderRadius: '12px',
                                            background: enrolling === course.id ? '#e2e8f0' : colors[idx % colors.length],
                                            color: enrolling === course.id ? '#888' : 'white',
                                            cursor: enrolling === course.id ? 'default' : 'pointer',
                                            fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {enrolling === course.id ? 'Записуємось...' : '✅ Вибрати цей курс'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseSelect;
