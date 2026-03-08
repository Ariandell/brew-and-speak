import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';

const Levels: React.FC = () => {
    const navigate = useNavigate();

    const mockLevels = [
        { id: 1, title: 'Перший ковток', desc: 'Для тих, хто тільки знайомиться з англійською', icon: '🌱' },
        { id: 2, title: 'Вже розбираюсь', desc: 'Впевнено замовляю каву англійською', icon: '☕' },
        { id: 3, title: 'Профі-бариста', desc: 'Можу обговорити політику за еспресо', icon: '🏆' },
    ];

    return (
        <div className="page">
            <header className="page-header">
                <button className="page-header__back" onClick={() => navigate(-1)}>←</button>
                <h1 className="page-title">Рівні</h1>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {mockLevels.map(level => (
                    <Card key={level.id} onClick={() => navigate(`/levels/${level.id}`)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="btn--circle" style={{ flexShrink: 0, display: 'flex', fontSize: '1.5rem', background: 'var(--gradient-warm)' }}>
                            {level.icon}
                        </div>
                        <div>
                            <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800 }}>{level.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>{level.desc}</p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Levels;
