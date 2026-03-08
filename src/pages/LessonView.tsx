import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProgressBar } from '../components/ui/ProgressBar';
import { FeedbackBanner } from '../components/ui/FeedbackBanner';
import { useUserId } from '../components/TelegramProvider';

const API = '''';

// ─── Block Renderers ───────────────────────────────────────────────────────

const TextBlock: React.FC<{ content: any }> = ({ content }) => (
    <div style={{ lineHeight: 1.7, fontSize: '1rem', color: '#1a1a2e' }}>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{content.body}</p>
    </div>
);



const QuizBlock: React.FC<{ content: any, onMistake?: () => void }> = ({ content, onMistake }) => {
    const [selected, setSelected] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);

    const handleSelect = (i: number) => {
        if (answered) return;
        setSelected(i);
        setAnswered(true);
        if (content.options && !content.options[i].isCorrect && onMistake) {
            onMistake();
        }
    };
    return (
        <div>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>{content.question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {content.options?.map((opt: any, i: number) => {
                    const isSelected = selected === i;
                    const showRight = answered && opt.isCorrect;
                    const showWrong = answered && isSelected && !opt.isCorrect;
                    return (
                        <button key={i} onClick={() => handleSelect(i)} style={{
                            padding: '12px 16px', border: `2px solid ${showRight ? '#10b981' : showWrong ? '#ef4444' : isSelected ? 'var(--color-primary)' : '#e2e8f0'}`,
                            borderRadius: '12px', background: showRight ? '#d1fae5' : showWrong ? '#fee2e2' : isSelected ? '#ede9fe' : 'white',
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.95rem',
                            textAlign: 'left', fontWeight: isSelected ? 600 : 400, color: '#1a1a2e', transition: 'all 0.2s'
                        }}>
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const WordOrderBlock: React.FC<{ content: any }> = ({ content }) => {
    const words: string[] = content.sentence?.split(' ') || [];
    const [shuffled] = useState<string[]>(() => [...words].sort(() => Math.random() - 0.5));
    const [chosen, setChosen] = useState<string[]>([]);
    const [remaining, setRemaining] = useState<string[]>(shuffled);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    const addWord = (word: string, idx: number) => {
        if (answered) return;
        setChosen(c => [...c, word]);
        setRemaining(r => { const n = [...r]; n.splice(idx, 1); return n; });
    };

    const removeWord = (word: string, idx: number) => {
        if (answered) return;
        setRemaining(r => [...r, word]);
        setChosen(c => { const n = [...c]; n.splice(idx, 1); return n; });
    };

    const check = () => {
        setIsCorrect(chosen.join(' ') === words.join(' '));
        setAnswered(true);
    };

    return (
        <div>
            <p style={{ fontWeight: 700, marginBottom: '1rem' }}>{content.prompt || 'Склади правильне речення:'}</p>
            {/* Chosen area */}
            <div style={{ minHeight: 44, border: '2px dashed #c4b5fd', borderRadius: '12px', padding: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem', backgroundColor: answered ? (isCorrect ? '#d1fae5' : '#fee2e2') : '#faf8ff' }}>
                {chosen.map((w, i) => (
                    <button key={i} onClick={() => removeWord(w, i)} style={{
                        padding: '6px 12px', backgroundColor: answered ? (isCorrect ? '#10b981' : '#ef4444') : 'var(--color-primary)', color: 'white',
                        border: 'none', borderRadius: '8px', cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600
                    }}>{w}</button>
                ))}
            </div>
            {/* Word bank */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
                {remaining.map((w, i) => (
                    <button key={i} onClick={() => addWord(w, i)} style={{
                        padding: '8px 14px', backgroundColor: 'white', border: '1px solid #e2e8f0',
                        borderRadius: '10px', cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.95rem'
                    }}>{w}</button>
                ))}
            </div>
            {!answered && (
                <button
                    onClick={check}
                    disabled={chosen.length !== words.length}
                    style={{
                        width: '100%', padding: '12px', background: 'var(--color-primary)', color: 'white',
                        border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
                        fontWeight: 700, opacity: chosen.length !== words.length ? 0.5 : 1
                    }}
                >
                    Перевірити
                </button>
            )}
            {answered && isCorrect && <p style={{ color: '#10b981', fontWeight: 700, textAlign: 'center', margin: 0 }}>✅ Правильно!</p>}
            {answered && !isCorrect && (
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#ef4444', fontWeight: 700, margin: '0 0 8px' }}>❌ Неправильно</p>
                    <p style={{ color: '#555', fontSize: '0.9rem', margin: 0 }}>Правильна відповідь: <b>{content.sentence}</b></p>
                </div>
            )}
        </div>
    );
};

const FillBlankBlock: React.FC<{ content: any, onMistake?: () => void }> = ({ content, onMistake }) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [answered, setAnswered] = useState(false);
    const sentence: string = content.sentence || '';
    const correctAnswer: string = content.answer || '';
    const options: string[] = content.options || [];

    const choose = (opt: string) => {
        if (answered) return;
        setSelected(opt);
        setAnswered(true);
        if (opt !== correctAnswer && onMistake) {
            onMistake();
        }
    };

    const displaySentence = sentence.replace('___', selected ? `[${selected}]` : '___');

    return (
        <div>
            <p style={{ fontWeight: 700, marginBottom: '1rem' }}>{content.prompt || 'Вставте пропущене слово:'}</p>
            <div style={{ background: answered ? (selected === correctAnswer ? '#d1fae5' : '#fee2e2') : '#faf8ff', border: '2px solid #ddd6fe', borderColor: answered ? (selected === correctAnswer ? '#10b981' : '#ef4444') : '#ddd6fe', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
                {displaySentence}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {options.map((opt, i) => {
                    const isSelected = selected === opt;
                    const showRight = answered && opt === correctAnswer;
                    const showWrong = answered && isSelected && opt !== correctAnswer;
                    return (
                        <button key={i} onClick={() => choose(opt)} style={{
                            padding: '10px 18px', border: `2px solid ${showRight ? '#10b981' : showWrong ? '#ef4444' : isSelected ? 'var(--color-primary)' : '#e2e8f0'}`,
                            borderRadius: '12px', background: showRight ? '#d1fae5' : showWrong ? '#fee2e2' : isSelected ? '#ede9fe' : 'white',
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600
                        }}>{opt}</button>
                    );
                })}
            </div>
        </div>
    );
};

const TrueFalseBlock: React.FC<{ content: any, onMistake?: () => void }> = ({ content, onMistake }) => {
    const [selected, setSelected] = useState<boolean | null>(null);
    const [answered, setAnswered] = useState(false);
    const choose = (val: boolean) => {
        if (answered) return;
        setSelected(val);
        setAnswered(true);
        if (val !== content.isTrue && onMistake) {
            onMistake();
        }
    };
    return (
        <div>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '1rem' }}>{content.statement}</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
                {[true, false].map(val => {
                    const label = val ? '✅ Вірно' : '❌ Хибно';
                    const isSelected = selected === val;
                    const correct = content.isTrue === val;
                    const showRight = answered && correct;
                    const showWrong = answered && isSelected && !correct;
                    return (
                        <button key={String(val)} onClick={() => choose(val)} style={{
                            flex: 1, padding: '14px', border: `2px solid ${showRight ? '#10b981' : showWrong ? '#ef4444' : isSelected ? 'var(--color-primary)' : '#e2e8f0'}`,
                            borderRadius: '14px', background: showRight ? '#d1fae5' : showWrong ? '#fee2e2' : isSelected ? '#ede9fe' : 'white',
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem'
                        }}>{label}</button>
                    );
                })}
            </div>
        </div>
    );
};

const MatchPairsBlock: React.FC<{ content: any, onMistake?: () => void }> = ({ content, onMistake }) => {
    const pairs: Array<{ word: string; translation: string }> = content.pairs || [];
    const [leftSelected, setLeftSelected] = useState<number | null>(null);
    const [matched, setMatched] = useState<Record<number, number>>({});
    const [wrong, setWrong] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);

    const shuffledRight = useRef(pairs.map((_, i) => i).sort(() => Math.random() - 0.5));

    const selectLeft = (i: number) => {
        if (answered || matched[i] !== undefined) return;
        setLeftSelected(i);
    };

    const selectRight = (rightIdx: number) => {
        if (answered || leftSelected === null) return;
        const pairIdx = shuffledRight.current[rightIdx];
        if (leftSelected === pairIdx) {
            const newMatched = { ...matched, [leftSelected]: rightIdx };
            setMatched(newMatched);
            setLeftSelected(null);
            if (Object.keys(newMatched).length === pairs.length) setAnswered(true);
        } else {
            setWrong(rightIdx);
            if (onMistake) onMistake();
            setTimeout(() => { setWrong(null); setLeftSelected(null); }, 600);
        }
    };

    const isMatchedRight = (rightIdx: number) => Object.values(matched).includes(rightIdx);

    return (
        <div>
            <p style={{ fontWeight: 700, marginBottom: '1rem' }}>{content.prompt || 'Знайдіть пари:'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pairs.map((p, i) => (
                        <button key={i} onClick={() => selectLeft(i)} style={{
                            padding: '10px', border: `2px solid ${matched[i] !== undefined ? '#10b981' : leftSelected === i ? 'var(--color-primary)' : '#e2e8f0'}`,
                            borderRadius: '10px', background: matched[i] !== undefined ? '#d1fae5' : leftSelected === i ? '#ede9fe' : 'white',
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem'
                        }}>{p.word}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {shuffledRight.current.map((pairIdx, rightIdx) => (
                        <button key={rightIdx} onClick={() => selectRight(rightIdx)} style={{
                            padding: '10px', border: `2px solid ${isMatchedRight(rightIdx) ? '#10b981' : wrong === rightIdx ? '#ef4444' : '#e2e8f0'}`,
                            borderRadius: '10px', background: isMatchedRight(rightIdx) ? '#d1fae5' : wrong === rightIdx ? '#fee2e2' : 'white',
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem'
                        }}>{pairs[pairIdx].translation}</button>
                    ))}
                </div>
            </div>
            {answered && <p style={{ color: '#10b981', fontWeight: 700, textAlign: 'center', marginTop: '1rem', marginBottom: 0 }}>✅ Всі пари знайдені!</p>}
        </div>
    );
};

const AudioBlock: React.FC<{ content: any }> = ({ content }) => (
    <div>
        {content.caption && <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{content.caption}</p>}
        {content.audioUrl ? (
            <audio controls style={{ width: '100%', borderRadius: '12px' }} src={`${API}${content.audioUrl}`} />
        ) : (
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', color: '#888', textAlign: 'center' }}>🎵 Аудіо файл</div>
        )}
    </div>
);

const HomeworkPromptBlock: React.FC<{ content: any; lessonId: string; navigate: any }> = ({ content, lessonId, navigate }) => (
    <div>
        <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{content.prompt}</p>
        <button
            onClick={() => navigate(`/homework/${lessonId}`)}
            style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: '12px',
                background: '#047857', color: 'white', cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 700, fontSize: '0.95rem'
            }}
        >
            📎 Здати домашнє завдання
        </button>
    </div>
);

// ─── Main Component ────────────────────────────────────────────────────────

const LessonView: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const USER_ID = useUserId();

    const [blocks, setBlocks] = useState<any[]>([]);
    const [lesson, setLesson] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [finishing, setFinishing] = useState(false);
    const [score, setScore] = useState(10);
    const startTimeRef = useRef<number>(Date.now());

    const handleMistake = () => {
        setScore(prev => Math.max(1, prev - 1));
    };

    useEffect(() => {
        startTimeRef.current = Date.now();
        if (!id) return;
        Promise.all([
            fetch(`${API}/api/lessons/${id}`).then(r => r.json()),
            fetch(`${API}/api/lessons/${id}/blocks`).then(r => r.json())
        ]).then(([lessonData, blocksData]) => {
            setLesson(lessonData);

            // Defensively parse content in case it comes back as a string
            const safeBlocks = (Array.isArray(blocksData) ? blocksData : []).map(b => {
                let parsedContent = b.content;
                if (typeof parsedContent === 'string') {
                    try { parsedContent = JSON.parse(parsedContent); } catch { parsedContent = {}; }
                }
                return { ...b, content: parsedContent || {} };
            });

            setBlocks(safeBlocks);
        }).catch(() => { }).finally(() => setLoading(false));
    }, [id]);

    const handleFinish = async () => {
        setFinishing(true);
        const timeSpent = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
        try {
            await fetch(`${API}/api/lessons/${id}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, needsTeacherReview: false, score, timeSpent })
            });
            navigate('/');
        } catch {
            setFinishing(false);
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Завантаження уроку...</div>
    );

    if (blocks.length === 0) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: '#888' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <p style={{ fontWeight: 600, marginBottom: '4px' }}>У цьому уроці ще немає завдань</p>
            <p style={{ fontSize: '0.85rem', marginBottom: '2rem' }}>Викладач ще не додав контент</p>
            <button onClick={() => navigate('/')} style={{ padding: '12px 24px', border: 'none', borderRadius: '12px', background: 'var(--color-primary)', color: 'white', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Назад</button>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{ padding: '0.8rem 1rem', backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 20 }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: 'inherit', padding: '4px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>
                        {lesson?.title || 'Урок'}
                    </h1>
                </div>
                <div style={{ width: 30 }} /> {/* Spacer for centering */}
            </header>

            {/* Block content */}
            <div style={{ flex: 1, padding: '1.2rem', paddingBottom: '120px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {blocks.map((block, idx) => {
                    return (
                        <div key={idx} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                            {block.type === 'text' && <TextBlock content={block.content} />}
                            {block.type === 'quiz' && <QuizBlock content={block.content} onMistake={handleMistake} />}
                            {block.type === 'word_order' && <WordOrderBlock content={block.content} />}
                            {block.type === 'fill_blank' && <FillBlankBlock content={block.content} onMistake={handleMistake} />}
                            {block.type === 'true_false' && <TrueFalseBlock content={block.content} onMistake={handleMistake} />}
                            {block.type === 'match_pairs' && <MatchPairsBlock content={block.content} onMistake={handleMistake} />}
                            {block.type === 'audio' && <AudioBlock content={block.content} />}
                            {block.type === 'photo' && (
                                <div>
                                    {block.content.imageUrl && <img src={block.content.imageUrl.startsWith('http') ? block.content.imageUrl : `${API}${block.content.imageUrl}`} alt="" style={{ width: '100%', borderRadius: '12px', marginBottom: '0.75rem' }} />}
                                    {block.content.caption && <p style={{ margin: 0, color: '#555' }}>{block.content.caption}</p>}
                                </div>
                            )}
                            {block.type === 'homework' && <HomeworkPromptBlock content={block.content} lessonId={id || ''} navigate={navigate} />}
                        </div>
                    );
                })}

                {/* Finish Lesson Button */}
                <div style={{ marginTop: '1rem' }}>
                    <button
                        onClick={handleFinish}
                        disabled={finishing}
                        style={{
                            width: '100%', padding: '16px', border: 'none', borderRadius: '16px',
                            background: finishing ? '#a78bfa' : 'var(--color-primary)', color: 'white',
                            cursor: finishing ? 'default' : 'pointer', fontFamily: 'inherit',
                            fontSize: '1.05rem', fontWeight: 800,
                            boxShadow: '0 4px 14px rgba(91, 33, 182, 0.3)'
                        }}
                    >
                        {finishing ? 'Завершуємо...' : '✅ Завершити урок'}
                    </button>
                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#888', marginTop: '12px' }}>
                        Натисніть кнопку коли пройдете всі матеріали.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LessonView;
