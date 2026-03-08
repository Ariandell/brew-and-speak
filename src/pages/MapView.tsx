import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';

interface Lesson {
    id: number;
    level_id: number;
    title: string;
    theme_background: string;
    order: number;
}

interface Level {
    id: number;
    title: string;
    description: string;
    order: number;
    lessons: Lesson[];
}

const MapView: React.FC = () => {
    const navigate = useNavigate();
    const [mapData, setMapData] = useState<Level[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch Map Data
        fetch('/api/map')
            .then(res => res.json())
            .then(data => {
                // Expecting an array of levels
                if (Array.isArray(data)) {
                    setMapData(data);
                }
                setLoading(false);
            })
            .catch(e => {
                console.error('Failed to load map data', e);
                setLoading(false);
            });
    }, []);

    // Use API nodes if available, else fallback mock nodes (for testing)
    const nodes = mapData.length > 0 ?
        mapData.flatMap((level, levelIdx) =>
            level.lessons.map((l, i) => ({
                id: l.id,
                type: 'lesson',
                title: l.title,
                status: (levelIdx === 0 && i === 0) ? 'active' : 'locked' // fake logic: first active
            }))
        )
        : [
            { id: 1, type: 'lesson', title: 'Start', status: 'active' },
            { id: 2, type: 'lesson', title: 'Coffee', status: 'locked' }
        ];

    // Helper to calculate zigzag path
    const getOffset = (index: number) => {
        const offsets = [0, 40, 60, 40, 0, -40, -60, -40];
        return offsets[index % offsets.length];
    };

    return (
        <div className="page" style={{
            background: 'var(--color-bg-map)',
            minHeight: '100vh',
            paddingBottom: '120px',
            overflowX: 'hidden'
        }}>
            <header className="page-header" style={{ background: 'transparent', position: 'fixed', top: 0, left: 0, right: 0, padding: '1rem', zIndex: 100 }}>
                <div style={{ background: 'white', padding: '0.5rem 1rem', borderRadius: '1rem', fontWeight: 800, border: '2px solid var(--color-gray-light)', borderBottomWidth: '4px' }}>
                    ⭐ 12
                </div>
            </header>

            {/* Path Container: reverse flex to scroll visually from bottom to top */}
            <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: '3rem', paddingTop: '5rem', position: 'relative' }}>

                {/* SVG Path drawing connecting nodes */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
                    {/* Future: Dynamic SVG Path based on offsets */}
                    <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#e5e5e5" strokeWidth="15" strokeDasharray="20 15" strokeLinecap="round" />
                </svg>

                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-primary-shadow)' }}>
                        Будуємо карту...
                    </div>
                ) : nodes.map((node, i) => (
                    <div
                        key={node.id}
                        style={{
                            position: 'relative',
                            transform: `translateX(${getOffset(i)}px)`,
                            zIndex: 10
                        }}
                    >
                        {node.status === 'active' && (
                            <div className="animate-float" style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '0.4rem 0.8rem', borderRadius: '1rem', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--color-gray-light)', whiteSpace: 'nowrap' }}>
                                Пройди мене!
                                <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', borderTop: '6px solid white', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }} />
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <button
                                className={`map-node map-node--${node.status}`}
                                onClick={() => node.status !== 'locked' && navigate(`/lesson/${node.id}`)}
                                style={{ fontSize: '1rem', fontWeight: 900, color: node.status === 'locked' ? '#aaa' : 'white' }}
                            >
                                {node.type === 'lesson' ? `${i + 1}` : '🎁'}
                            </button>
                            <div style={{ marginTop: '0.8rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', textShadow: '0 2px 0 white', fontSize: '1.1rem' }}>
                                {node.title}
                            </div>
                        </div>
                    </div>
                ))}

            </div>
            <BottomNav />
        </div>
    );
};

export default MapView;
