import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Tile {
    emoji: string;
    label: string;
    sublabel: string;
    path: string;
    color: string;
    bg: string;
}

const tiles: Tile[] = [
    { emoji: '📚', label: 'Курси', sublabel: 'Створити та редагувати', path: '/admin/courses', color: '#5b21b6', bg: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' },
    { emoji: '💬', label: 'Чат', sublabel: 'Відповідати студентам', path: '/admin/chat', color: '#0e7490', bg: 'linear-gradient(135deg, #e0f7fa, #b2ebf2)' },
    { emoji: '📨', label: 'Розсилка', sublabel: 'Фото-повідомлення', path: '/admin/photo-messages', color: '#b45309', bg: 'linear-gradient(135deg, #fef3c7, #fde68a)' },
    { emoji: '📊', label: 'Статистика', sublabel: 'Успішність студентам', path: '/admin/stats', color: '#065f46', bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' },
];

const Dashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <header style={{
                padding: '1rem 1.2rem 0.8rem',
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
                    <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1a1a2e' }}>Кабінет викладача</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-primary)', fontWeight: 500 }}>Ольга</p>
                </div>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none', border: '1px solid rgba(0,0,0,0.12)',
                        borderRadius: '10px', padding: '8px 14px',
                        fontSize: '0.85rem', cursor: 'pointer', color: '#666',
                        fontFamily: 'inherit'
                    }}
                >
                    На головну
                </button>
            </header>

            <div style={{ padding: '1.5rem 1rem', flex: 1 }}>

                {/* Greeting */}
                <div style={{
                    background: 'linear-gradient(135deg, #5b21b6, #9333ea)',
                    borderRadius: '20px',
                    padding: '1.2rem 1.5rem',
                    color: 'white',
                    marginBottom: '1.5rem',
                    boxShadow: '0 8px 24px rgba(91,33,182,0.25)'
                }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>Вітаємо 👋</p>
                    <h2 style={{ margin: '4px 0 0', fontSize: '1.3rem', fontWeight: 700 }}>Що робимо сьогодні?</h2>
                </div>

                {/* Action tiles */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem'
                }}>
                    {tiles.map((tile) => (
                        <button
                            key={tile.path}
                            onClick={() => tile.path !== '#' && navigate(tile.path)}
                            style={{
                                background: tile.bg,
                                border: 'none',
                                borderRadius: '20px',
                                padding: '1.5rem 1rem',
                                textAlign: 'center',
                                cursor: tile.path !== '#' ? 'pointer' : 'default',
                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                fontFamily: 'inherit',
                                opacity: tile.path === '#' ? 0.6 : 1
                            }}
                            onTouchStart={(e) => { if (tile.path !== '#') (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)'; }}
                            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                        >
                            <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{tile.emoji}</span>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: tile.color }}>{tile.label}</span>
                            <span style={{ fontSize: '0.75rem', color: tile.color, opacity: 0.75, lineHeight: 1.3 }}>{tile.sublabel}</span>
                            {tile.path === '#' && <span style={{ fontSize: '0.7rem', color: tile.color, opacity: 0.6 }}>Незабаром</span>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
