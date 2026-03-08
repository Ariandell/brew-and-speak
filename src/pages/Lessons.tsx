import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';

const Lessons: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    // Mock data
    const lessons = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        title: `Урок ${i + 1}`,
        topic: ['Present Simple', 'Past Simple', 'Словник до кав\'ярні', 'Фразові дієслова'][i % 4],
        status: i === 0 ? 'completed' : i === 1 ? 'active' : 'locked'
    }));

    return (
        <div className="page">
            <header className="page-header">
                <button className="page-header__back" onClick={() => navigate(-1)}>←</button>
                <div>
                    <h1 className="page-title">Уроки</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Рівень {id}</p>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {lessons.map(lesson => (
                    <Card
                        key={lesson.id}
                        variant={lesson.status === 'locked' ? 'flat' : 'default'}
                        onClick={() => lesson.status !== 'locked' && navigate(`/lesson/${lesson.id}`)}
                        style={{
                            cursor: lesson.status === 'locked' ? 'not-allowed' : 'pointer',
                            opacity: lesson.status === 'locked' ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div>
                            <h3 style={{ fontWeight: 800 }}>{lesson.title}</h3>
                            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{lesson.topic}</p>
                        </div>
                        {lesson.status === 'completed' && <span className="badge badge--success">✓ Пройдено</span>}
                        {lesson.status === 'active' && <span className="badge badge--purple">Почати</span>}
                        {lesson.status === 'locked' && <span>🔒</span>}
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Lessons;
