import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProgressBar } from '../components/ui/ProgressBar';
import { FeedbackBanner } from '../components/ui/FeedbackBanner';
import { useUserId } from '../components/TelegramProvider';
import { RichText } from '../utils/RichText';
import { Mascot } from '../components/Mascot';
import { LessonResults } from '../components/LessonResults';

const API = '';

// ─── Block Renderers ───────────────────────────────────────────────────────

const TextBlock: React.FC<{ content: any }> = ({ content }) => (
    <div style={{ lineHeight: 1.7, fontSize: '1rem', color: '#1a1a2e' }}>
        <RichText value={content.body} />
    </div>
);



const QuizBlock: React.FC<{ content: any, onAnswer?: (correct: boolean) => void }> = ({ content, onAnswer }) => {
    const [selected, setSelected] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);

    // A half-finished option saved as an empty label renders as an unlabelled
    // button the student can still pick; drop those rather than show them.
    const options = (content.options || []).filter((o: any) => String(o?.label ?? '').trim());

    const handleSelect = (i: number) => {
        if (answered) return;
        setSelected(i);
        setAnswered(true);
        onAnswer?.(Boolean(options[i]?.isCorrect));
    };
    return (
        <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}><RichText value={content.question} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {options.map((opt: any, i: number) => {
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

const WordOrderBlock: React.FC<{ content: any, onAnswer?: (correct: boolean) => void }> = ({ content, onAnswer }) => {
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
        const right = chosen.join(' ') === words.join(' ');
        setIsCorrect(right);
        setAnswered(true);
        onAnswer?.(right);
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
                        borderRadius: '10px', cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.95rem', color: '#1a1a2e'
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

const FillBlankBlock: React.FC<{ content: any, onAnswer?: (correct: boolean) => void }> = ({ content, onAnswer }) => {
    const [selected, setSelected] = useState<string | null>(null);
    const [answered, setAnswered] = useState(false);
    const sentence: string = content.sentence || '';
    const correctAnswer: string = content.answer || '';
    const options: string[] = content.options || [];

    // The options input trims what the teacher types but the answer input does
    // not, so an answer saved as " catch " never equalled the "catch" option and
    // the question could not be answered correctly at all. Compare them trimmed.
    const isCorrect = (opt: string) => opt.trim() === correctAnswer.trim();

    const choose = (opt: string) => {
        if (answered) return;
        setSelected(opt);
        setAnswered(true);
        onAnswer?.(isCorrect(opt));
    };

    // Teachers mark the gap with however many underscores they feel like ("_",
    // "__", "___"), so match a run of them rather than exactly three. Sentences
    // with no underscore at all are shown unchanged - the picked option is still
    // visible in the buttons below.
    const answeredCorrectly = selected !== null && isCorrect(selected);
    const displaySentence = sentence.replace(/_+/, selected ? `[${selected.trim()}]` : '___');

    return (
        <div>
            <p style={{ fontWeight: 700, marginBottom: '1rem' }}>{content.prompt || 'Вставте пропущене слово:'}</p>
            <div style={{ background: answered ? (answeredCorrectly ? '#d1fae5' : '#fee2e2') : '#faf8ff', border: '2px solid #ddd6fe', borderColor: answered ? (answeredCorrectly ? '#10b981' : '#ef4444') : '#ddd6fe', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
                {displaySentence}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {options.map((opt, i) => {
                    const isSelected = selected === opt;
                    const showRight = answered && isCorrect(opt);
                    const showWrong = answered && isSelected && !isCorrect(opt);
                    return (
                        <button key={i} onClick={() => choose(opt)} style={{
                            padding: '10px 18px', border: `2px solid ${showRight ? '#10b981' : showWrong ? '#ef4444' : isSelected ? 'var(--color-primary)' : '#e2e8f0'}`,
                            borderRadius: '12px', background: showRight ? '#d1fae5' : showWrong ? '#fee2e2' : isSelected ? '#ede9fe' : 'white',
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, color: '#1a1a2e'
                        }}>{opt}</button>
                    );
                })}
            </div>
        </div>
    );
};

const TrueFalseBlock: React.FC<{ content: any, onAnswer?: (correct: boolean) => void }> = ({ content, onAnswer }) => {
    const [selected, setSelected] = useState<boolean | null>(null);
    const [answered, setAnswered] = useState(false);
    const choose = (val: boolean) => {
        if (answered) return;
        setSelected(val);
        setAnswered(true);
        onAnswer?.(val === content.isTrue);
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
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem', color: '#1a1a2e'
                        }}>{label}</button>
                    );
                })}
            </div>
        </div>
    );
};

const MatchPairsBlock: React.FC<{ content: any, onAnswer?: (correct: boolean) => void }> = ({ content, onAnswer }) => {
    const pairs: Array<{ word: string; translation: string }> = content.pairs || [];
    const [leftSelected, setLeftSelected] = useState<number | null>(null);
    const [matched, setMatched] = useState<Record<number, number>>({});
    const [wrong, setWrong] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);
    // The exercise only ends when every pair is matched, so it counts as done
    // then - correct if the student never picked a wrong one along the way.
    const misfired = useRef(false);

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
            if (Object.keys(newMatched).length === pairs.length) {
                setAnswered(true);
                onAnswer?.(!misfired.current);
            }
        } else {
            setWrong(rightIdx);
            misfired.current = true;
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
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem', color: '#1a1a2e'
                        }}>{p.word}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {shuffledRight.current.map((pairIdx, rightIdx) => (
                        <button key={rightIdx} onClick={() => selectRight(rightIdx)} style={{
                            padding: '10px', border: `2px solid ${isMatchedRight(rightIdx) ? '#10b981' : wrong === rightIdx ? '#ef4444' : '#e2e8f0'}`,
                            borderRadius: '10px', background: isMatchedRight(rightIdx) ? '#d1fae5' : wrong === rightIdx ? '#fee2e2' : 'white',
                            cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', color: '#1a1a2e'
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
        <div style={{ marginBottom: '1rem', lineHeight: 1.6 }}><RichText value={content.prompt} /></div>
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

// Laid out as it was in the March 20 build: centred, 100px, text in the bubble
// above the mascot.
const MascotTipBlock: React.FC<{ content: any }> = ({ content }) => {
    if (!String(content.text || '').trim()) return null;
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
            <Mascot mood={content.mood} size={100} speechBubble={<RichText value={content.text} />} />
        </div>
    );
};

// Block types that count towards the score. Reading and listening blocks have
// no right answer, so they must not dilute the percentage.
const SCORED_TYPES = ['quiz', 'fill_blank', 'true_false', 'match_pairs', 'word_order'];

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
    const [results, setResults] = useState<{ correct: number; mistakes: number; timeSpent: number } | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    // Both sets are keyed by block, so a block counts once however many times it
    // is touched. Tracking answered separately from mistakes is what stops a
    // skipped lesson scoring full marks: an exercise nobody attempted is not
    // correct, it is simply not answered.
    const answeredBlocks = useRef<Set<number>>(new Set());
    const mistakeBlocks = useRef<Set<number>>(new Set());

    const handleAnswer = (blockIndex: number, correct: boolean) => {
        if (answeredBlocks.current.has(blockIndex)) return; // first attempt is the one that counts
        answeredBlocks.current.add(blockIndex);
        if (!correct) mistakeBlocks.current.add(blockIndex);
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

        // The March build derived the stored mark from the result rather than
        // from a running counter, and counted anything left unanswered against
        // it. A counter that only ever decrements on a mistake records full
        // marks for a lesson clicked straight through - which is what the
        // student saw on screen, and what the teacher's statistics would show.
        const scored = blocks.filter(b => SCORED_TYPES.includes(b.type)).length;
        const correct = answeredBlocks.current.size - mistakeBlocks.current.size;
        const mark = scored > 0 ? Math.max(1, Math.round((correct / scored) * 10)) : 10;
        setScore(mark);

        try {
            await fetch(`${API}/api/lessons/${id}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, needsTeacherReview: false, score: mark, timeSpent })
            });
            setResults({
                correct,
                mistakes: mistakeBlocks.current.size,
                timeSpent,
            });
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
                            {block.type === 'quiz' && <QuizBlock content={block.content} onAnswer={ok => handleAnswer(idx, ok)} />}
                            {block.type === 'word_order' && <WordOrderBlock content={block.content} onAnswer={ok => handleAnswer(idx, ok)} />}
                            {block.type === 'fill_blank' && <FillBlankBlock content={block.content} onAnswer={ok => handleAnswer(idx, ok)} />}
                            {block.type === 'true_false' && <TrueFalseBlock content={block.content} onAnswer={ok => handleAnswer(idx, ok)} />}
                            {block.type === 'match_pairs' && <MatchPairsBlock content={block.content} onAnswer={ok => handleAnswer(idx, ok)} />}
                            {block.type === 'audio' && <AudioBlock content={block.content} />}
                            {block.type === 'photo' && (
                                <div>
                                    {block.content.imageUrl && <img src={block.content.imageUrl.startsWith('http') ? block.content.imageUrl : `${API}${block.content.imageUrl}`} alt="" style={{ width: '100%', borderRadius: '12px', marginBottom: '0.75rem' }} />}
                                    {block.content.caption && <p style={{ margin: 0, color: '#555' }}>{block.content.caption}</p>}
                                </div>
                            )}
                            {block.type === 'homework' && <HomeworkPromptBlock content={block.content} lessonId={id || ''} navigate={navigate} />}
                            {block.type === 'mascot_tip' && <MascotTipBlock content={block.content} />}
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

            {results && (
                <LessonResults
                    totalQuestions={blocks.filter(b => SCORED_TYPES.includes(b.type)).length}
                    correct={results.correct}
                    mistakes={results.mistakes}
                    timeSpent={results.timeSpent}
                    lessonTitle={lesson?.title || 'Урок'}
                    hasHomework={blocks.some(b => b.type === 'homework')}
                    onGoHome={() => navigate('/')}
                    onGoHomework={() => navigate(`/homework/${id}`)}
                />
            )}
        </div>
    );
};

export default LessonView;
