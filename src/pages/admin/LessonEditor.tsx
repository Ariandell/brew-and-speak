import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = '''';

type BlockType = 'text' | 'quiz' | 'word_order' | 'fill_blank' | 'match_pairs' | 'true_false' | 'audio' | 'photo' | 'homework';

interface BlockState { id: string; type: BlockType; content: any; }

const blockMeta: Record<BlockType, { emoji: string; label: string; desc: string; color: string }> = {
    text: { emoji: '📝', label: 'Пояснення', desc: 'Текстовий блок', color: '#4f46e5' },
    quiz: { emoji: '🔘', label: 'Тест', desc: 'Варіанти відповіді', color: '#7c3aed' },
    word_order: { emoji: '🔀', label: 'Порядок слів', desc: 'Скласти речення з слів', color: '#b45309' },
    fill_blank: { emoji: '✏️', label: 'Пропущене слово', desc: 'Вибрати слово для речення', color: '#0e7490' },
    match_pairs: { emoji: '🔗', label: 'Знайди пару', desc: 'Слово ↔ переклад', color: '#6d28d9' },
    true_false: { emoji: '✅', label: 'Вірно / Хибно', desc: 'Твердження — правда чи ні', color: '#047857' },
    audio: { emoji: '🎵', label: 'Аудіо', desc: 'MP3, OGG, M4A файл', color: '#9f1239' },
    photo: { emoji: '🖼️', label: 'Фото + текст', desc: 'Зображення з підписом', color: '#92400e' },
    homework: { emoji: '📋', label: 'Домашнє завдання', desc: 'Студент здає файл або текст', color: '#065f46' },
};

const defaultContent = (type: BlockType): any => {
    switch (type) {
        case 'text': return { body: '' };
        case 'quiz': return { question: '', options: [{ label: '', isCorrect: true }, { label: '', isCorrect: false }] };
        case 'word_order': return { prompt: 'Склади правильне речення:', sentence: '' };
        case 'fill_blank': return { prompt: 'Вstavте пропущене слово:', sentence: 'Я ___ студент.', answer: '', options: [] };
        case 'match_pairs': return { prompt: 'Знайдіть пари:', pairs: [{ word: '', translation: '' }] };
        case 'true_false': return { statement: '', isTrue: true };
        case 'audio': return { audioUrl: '', caption: '' };
        case 'photo': return { imageUrl: '', caption: '' };
        case 'homework': return { prompt: '', requiresReview: true };
        default: return {};
    }
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px',
    fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
    background: '#fafafa', resize: 'vertical' as 'vertical'
};

const LessonEditor: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isNew = !id || id === 'new';

    const [title, setTitle] = useState('');
    const [blocks, setBlocks] = useState<BlockState[]>([]);
    const [showBlockMenu, setShowBlockMenu] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(!isNew);
    const [flashcards, setFlashcards] = useState<{ front: string; back: string }[]>([]);

    useEffect(() => {
        if (!isNew && id) {
            setLoading(true);
            Promise.all([
                fetch(`${API}/api/lessons/${id}`).then(r => r.json()),
                fetch(`${API}/api/lessons/${id}/blocks`).then(r => r.json()),
                fetch(`${API}/api/admin/lessons/${id}/flashcards`).then(r => r.json())
            ]).then(([lesson, blocksData, fcData]) => {
                setTitle(lesson?.title || '');
                setBlocks(Array.isArray(blocksData) ? blocksData.map((b: any) => ({ id: String(b.id), type: b.type, content: b.content })) : []);
                setFlashcards(Array.isArray(fcData) ? fcData.map((f: any) => ({ front: f.front, back: f.back })) : []);
            }).finally(() => setLoading(false));
        }
    }, [id, isNew]);

    const addBlock = (type: BlockType) => {
        setBlocks(prev => [...prev, { id: `new-${Date.now()}`, type, content: defaultContent(type) }]);
        setShowBlockMenu(false);
    };

    const removeBlock = (bid: string) => setBlocks(prev => prev.filter(b => b.id !== bid));
    const updateBlock = (bid: string, content: any) => setBlocks(prev => prev.map(b => b.id === bid ? { ...b, content: { ...b.content, ...content } } : b));

    const save = async () => {
        if (!id || isNew) return;
        setSaving(true);
        try {
            if (title) await fetch(`${API}/api/lessons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
            await fetch(`${API}/api/lessons/${id}/blocks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks }) });
            await fetch(`${API}/api/admin/lessons/${id}/flashcards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flashcards.filter(f => f.front.trim() || f.back.trim())) });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const uploadFile = async (bid: string, field: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.url) updateBlock(bid, { [field]: data.url });
        } catch { }
    };

    if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Завантаження...</div>;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '120px' }}>
            {/* Header */}
            <header style={{ padding: '0.8rem 1rem', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 20 }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, fontSize: '1rem', fontFamily: 'inherit', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Назад
                </button>
                <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1, textAlign: 'center', color: '#1a1a2e' }}>🧱 Конструктор уроку</h1>
                <button onClick={save} disabled={saving || isNew} style={{ padding: '8px 16px', border: 'none', borderRadius: '10px', background: saved ? '#10b981' : 'var(--color-primary)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, transition: 'background 0.3s', flexShrink: 0, opacity: isNew ? 0.4 : 1 }}>
                    {saved ? '✓' : saving ? '...' : 'Зберегти'}
                </button>
            </header>

            <div style={{ padding: '1rem' }}>
                {/* Title */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1rem 1.2rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600, display: 'block', marginBottom: '6px' }}>НАЗВА УРОКУ</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Напр: Present Simple" style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: 600, color: '#1a1a2e', fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box' }} />
                </div>

                {/* Blocks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {blocks.map((block, index) => {
                        const meta = blockMeta[block.type];
                        if (!meta) return null; // skip unknown/removed block types
                        return (
                            <div key={block.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0.8rem 1rem', borderBottom: '1px solid #f1f5f9', gap: '10px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{meta.emoji}</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: meta.color, flex: 1 }}>{index + 1}. {meta.label}</span>
                                    <button onClick={() => removeBlock(block.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', width: 30, height: 30, color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

                                    {block.type === 'text' && (
                                        <textarea value={block.content.body} onChange={e => updateBlock(block.id, { body: e.target.value })} placeholder="Введіть пояснення..." rows={4} style={inputStyle} />
                                    )}



                                    {block.type === 'quiz' && (
                                        <>
                                            <input value={block.content.question} onChange={e => updateBlock(block.id, { question: e.target.value })} placeholder="Питання тесту..." style={inputStyle} />
                                            <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#888', fontWeight: 600 }}>ВАРІАНТИ (✓ — правильний)</p>
                                            {block.content.options?.map((opt: any, i: number) => (
                                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <button onClick={() => updateBlock(block.id, { options: block.content.options.map((o: any, j: number) => ({ ...o, isCorrect: j === i })) })} style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid', borderColor: opt.isCorrect ? '#10b981' : '#e2e8f0', background: opt.isCorrect ? '#10b981' : 'white', color: opt.isCorrect ? 'white' : '#aaa', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</button>
                                                    <input value={opt.label} onChange={e => { const opts = block.content.options.map((o: any, j: number) => j === i ? { ...o, label: e.target.value } : o); updateBlock(block.id, { options: opts }); }} placeholder={`Варіант ${i + 1}`} style={{ ...inputStyle, flex: 1, margin: 0 }} />
                                                    {block.content.options.length > 2 && <button onClick={() => updateBlock(block.id, { options: block.content.options.filter((_: any, j: number) => j !== i) })} style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', width: 28, height: 28, color: '#ef4444', cursor: 'pointer', flexShrink: 0, fontSize: '0.85rem' }}>✕</button>}
                                                </div>
                                            ))}
                                            <button onClick={() => updateBlock(block.id, { options: [...(block.content.options || []), { label: '', isCorrect: false }] })} style={{ padding: '8px', border: '1px dashed #c4b5fd', borderRadius: '10px', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>+ Ще варіант</button>
                                        </>
                                    )}

                                    {block.type === 'word_order' && (
                                        <>
                                            <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>ПІДКАЗКА ДЛЯ СТУДЕНТА</label>
                                            <input value={block.content.prompt} onChange={e => updateBlock(block.id, { prompt: e.target.value })} placeholder="Напр: Склади правильне речення" style={inputStyle} />
                                            <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>ПРАВИЛЬНЕ РЕЧЕННЯ</label>
                                            <input value={block.content.sentence} onChange={e => updateBlock(block.id, { sentence: e.target.value })} placeholder="Напр: I am a student" style={inputStyle} />
                                            {block.content.sentence && (
                                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '8px 12px', fontSize: '0.82rem', color: '#888' }}>
                                                    Слова: {block.content.sentence.split(' ').join(' | ')}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {block.type === 'fill_blank' && (
                                        <>
                                            <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>ПІДКАЗКА</label>
                                            <input value={block.content.prompt} onChange={e => updateBlock(block.id, { prompt: e.target.value })} placeholder="Вставте пропущене слово:" style={inputStyle} />
                                            <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>РЕЧЕННЯ (використай ___ для пропуску)</label>
                                            <input value={block.content.sentence} onChange={e => updateBlock(block.id, { sentence: e.target.value })} placeholder="Напр: I ___ a student." style={inputStyle} />
                                            <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>ПРАВИЛЬНА ВІДПОВІДЬ</label>
                                            <input value={block.content.answer} onChange={e => updateBlock(block.id, { answer: e.target.value })} placeholder="Напр: am" style={inputStyle} />
                                            <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>ВАРІАНТИ ВІДПОВІДЕЙ (через кому)</label>
                                            <input value={(block.content.options || []).join(', ')} onChange={e => updateBlock(block.id, { options: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} placeholder="am, is, are, be" style={inputStyle} />
                                        </>
                                    )}

                                    {block.type === 'match_pairs' && (
                                        <>
                                            <label style={{ fontSize: '0.78rem', color: '#888', fontWeight: 600 }}>ПАРИ (слово ↔ переклад)</label>
                                            {block.content.pairs?.map((pair: any, i: number) => (
                                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <input value={pair.word} onChange={e => { const p = block.content.pairs.map((pp: any, j: number) => j === i ? { ...pp, word: e.target.value } : pp); updateBlock(block.id, { pairs: p }); }} placeholder="Слово" style={{ ...inputStyle, flex: 1, margin: 0 }} />
                                                    <span style={{ color: '#aaa' }}>↔</span>
                                                    <input value={pair.translation} onChange={e => { const p = block.content.pairs.map((pp: any, j: number) => j === i ? { ...pp, translation: e.target.value } : pp); updateBlock(block.id, { pairs: p }); }} placeholder="Переклад" style={{ ...inputStyle, flex: 1, margin: 0 }} />
                                                    {block.content.pairs.length > 1 && <button onClick={() => updateBlock(block.id, { pairs: block.content.pairs.filter((_: any, j: number) => j !== i) })} style={{ background: '#fee2e2', border: 'none', borderRadius: '6px', width: 28, height: 28, color: '#ef4444', cursor: 'pointer', flexShrink: 0, fontSize: '0.85rem' }}>✕</button>}
                                                </div>
                                            ))}
                                            <button onClick={() => updateBlock(block.id, { pairs: [...(block.content.pairs || []), { word: '', translation: '' }] })} style={{ padding: '8px', border: '1px dashed #c4b5fd', borderRadius: '10px', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>+ Ще пара</button>
                                        </>
                                    )}

                                    {block.type === 'true_false' && (
                                        <>
                                            <input value={block.content.statement} onChange={e => updateBlock(block.id, { statement: e.target.value })} placeholder="Твердження (напр: Cats can fly)" style={inputStyle} />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#555', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={block.content.isTrue} onChange={e => updateBlock(block.id, { isTrue: e.target.checked })} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                                Правильне твердження (Вірно)
                                            </label>
                                        </>
                                    )}

                                    {block.type === 'audio' && (
                                        <>
                                            <input value={block.content.caption} onChange={e => updateBlock(block.id, { caption: e.target.value })} placeholder="Підпис до аудіо (необов'язково)" style={inputStyle} />
                                            {block.content.audioUrl ? (
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <audio controls src={`${API}${block.content.audioUrl}`} style={{ flex: 1 }} />
                                                    <button onClick={() => updateBlock(block.id, { audioUrl: '' })} style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', width: 32, height: 32, color: '#ef4444', cursor: 'pointer' }}>✕</button>
                                                </div>
                                            ) : (
                                                <label style={{ display: 'block', cursor: 'pointer' }}>
                                                    <div style={{ border: '2px dashed #fca5a5', borderRadius: '12px', padding: '1.2rem', textAlign: 'center', color: '#9f1239' }}>
                                                        <div style={{ fontSize: '1.8rem' }}>🎵</div>
                                                        <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '0.9rem' }}>Завантажити аудіо (.mp3, .ogg, .m4a)</p>
                                                    </div>
                                                    <input type="file" accept=".mp3,.ogg,.m4a,audio/*" onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadFile(block.id, 'audioUrl', f); }} style={{ display: 'none' }} />
                                                </label>
                                            )}
                                        </>
                                    )}

                                    {block.type === 'photo' && (
                                        <>
                                            {block.content.imageUrl ? (
                                                <div>
                                                    <img src={block.content.imageUrl.startsWith('http') ? block.content.imageUrl : `${API}${block.content.imageUrl}`} alt="" style={{ width: '100%', borderRadius: '12px', marginBottom: '8px' }} />
                                                    <button onClick={() => updateBlock(block.id, { imageUrl: '' })} style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '6px 12px', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>✕ Видалити фото</button>
                                                </div>
                                            ) : (
                                                <label style={{ display: 'block', cursor: 'pointer' }}>
                                                    <div style={{ border: '2px dashed #fcd34d', borderRadius: '12px', padding: '1.2rem', textAlign: 'center', color: '#92400e' }}>
                                                        <div style={{ fontSize: '1.8rem' }}>🖼️</div>
                                                        <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '0.9rem' }}>Завантажити фото</p>
                                                    </div>
                                                    <input type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) await uploadFile(block.id, 'imageUrl', f); }} style={{ display: 'none' }} />
                                                </label>
                                            )}
                                            <input value={block.content.caption} onChange={e => updateBlock(block.id, { caption: e.target.value })} placeholder="Підпис (необов'язково)" style={inputStyle} />
                                        </>
                                    )}

                                    {block.type === 'homework' && (
                                        <>
                                            <textarea value={block.content.prompt} onChange={e => updateBlock(block.id, { prompt: e.target.value })} placeholder="Опис домашнього завдання..." rows={3} style={inputStyle} />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#555', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={block.content.requiresReview} onChange={e => updateBlock(block.id, { requiresReview: e.target.checked })} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                                Потрібна перевірка викладача
                                            </label>
                                        </>
                                    )}

                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add Block */}
                <div style={{ marginTop: '0.75rem' }}>
                    {!showBlockMenu ? (
                        <button onClick={() => setShowBlockMenu(true)} style={{ width: '100%', padding: '1rem', border: '2px dashed #c4b5fd', borderRadius: '16px', background: 'transparent', cursor: 'pointer', color: 'var(--color-primary)', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            ➕ Додати блок
                        </button>
                    ) : (
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '0.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.8rem 0.3rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#888' }}>ТИП БЛОКУ</span>
                                <button onClick={() => setShowBlockMenu(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
                            </div>
                            {(Object.keys(blockMeta) as BlockType[]).map(type => {
                                const m = blockMeta[type];
                                return (
                                    <button key={type} onClick={() => addBlock(type)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.8rem 1rem', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '12px', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
                                        <span style={{ fontSize: '1.4rem', width: 32, textAlign: 'center' }}>{m.emoji}</span>
                                        <div>
                                            <div style={{ fontWeight: 600, color: m.color, fontSize: '0.9rem' }}>{m.label}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#aaa' }}>{m.desc}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Vocabulary Section */}
            <div style={{ marginTop: '2rem', padding: '0 1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📖 Словник уроку
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>({flashcards.length} слів)</span>
                </h3>

                {flashcards.map((fc, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Слово (en)"
                            value={fc.front}
                            onChange={e => { const updated = [...flashcards]; updated[idx] = { ...fc, front: e.target.value }; setFlashcards(updated); }}
                            style={{ ...inputStyle, flex: 1 }}
                        />
                        <input
                            type="text"
                            placeholder="Переклад (ua)"
                            value={fc.back}
                            onChange={e => { const updated = [...flashcards]; updated[idx] = { ...fc, back: e.target.value }; setFlashcards(updated); }}
                            style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                            onClick={() => setFlashcards(prev => prev.filter((_, i) => i !== idx))}
                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '10px', width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}
                        >✕</button>
                    </div>
                ))}

                <button
                    onClick={() => setFlashcards(prev => [...prev, { front: '', back: '' }])}
                    style={{ width: '100%', padding: '0.75rem', border: '2px dashed #c4b5fd', borderRadius: '12px', background: 'transparent', cursor: 'pointer', color: '#7c3aed', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                    ➕ Додати слово
                </button>
            </div>
            <div style={{ height: '80px' }} /> {/* Spacer for fixed save button */}
            {/* Fixed Save */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'rgba(255,255,255,0.97)', borderTop: '1px solid rgba(0,0,0,0.08)', zIndex: 30 }}>
                <button onClick={save} disabled={saving || isNew} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '14px', background: saved ? '#10b981' : 'var(--color-primary)', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700, transition: 'background 0.3s', opacity: isNew ? 0.5 : 1 }}>
                    {isNew ? 'Спочатку створіть урок у списку' : saved ? '✓ Збережено!' : saving ? 'Зберігаємо...' : '💾 Зберегти урок'}
                </button>
            </div>
        </div>
    );
};

export default LessonEditor;
