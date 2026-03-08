import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserId } from '../components/TelegramProvider';

const API = 'http://localhost:3000';

const HomeworkSubmit: React.FC = () => {
    const navigate = useNavigate();
    const { lessonId } = useParams();
    const USER_ID = useUserId();
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 20 * 1024 * 1024) {
            setError('Файл занадто великий. Максимум 20МБ.');
            return;
        }
        setError('');
        setFile(f);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() && !file) return;
        setSubmitting(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('lesson_id', lessonId || '');
            formData.append('user_id', USER_ID);
            formData.append('text', text);
            if (file) formData.append('file', file);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API}/api/homework`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
            };

            await new Promise<void>((resolve, reject) => {
                xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error('Upload failed'));
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(formData);
            });

            setSubmitted(true);
        } catch (err) {
            setError('Помилка при відправці. Спробуйте ще раз.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎉</div>
                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e' }}>Відправлено!</h2>
                <p style={{ textAlign: 'center', color: '#666', marginBottom: '2rem', lineHeight: 1.5 }}>
                    Викладач перевірить ваше завдання і надішле відповідь у чат.
                </p>
                <button
                    onClick={() => navigate('/')}
                    style={{ padding: '14px 32px', border: 'none', borderRadius: '14px', background: 'var(--color-primary)', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    На головну
                </button>
            </div>
        );
    }

    const fileIcon = (name: string) => {
        if (name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return '🖼️';
        if (name.match(/\.(pdf)$/i)) return '📄';
        if (name.match(/\.(doc|docx)$/i)) return '📝';
        if (name.match(/\.(txt)$/i)) return '📃';
        return '📎';
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header style={{
                padding: '0.8rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'sticky',
                top: 0,
                zIndex: 20
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, fontSize: '1rem', fontFamily: 'inherit' }}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Назад
                </button>
                <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1, textAlign: 'center' }}>📋 Домашнє завдання</h1>
                <div style={{ width: 70 }}></div>
            </header>

            <form onSubmit={handleSubmit} style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Text answer */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#888', marginBottom: '8px' }}>ТЕКСТОВА ВІДПОВІДЬ</label>
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Напишіть вашу відповідь тут..."
                        rows={5}
                        style={{ width: '100%', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', color: '#1a1a2e', boxSizing: 'border-box', background: 'transparent' }}
                    />
                </div>

                {/* File upload */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#888', marginBottom: '8px' }}>ПРИКРІПИТИ ФАЙЛ (необов'язково, до 20МБ)</label>

                    {file ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.75rem', background: '#f8fafc', borderRadius: '12px' }}>
                            <span style={{ fontSize: '2rem' }}>{fileIcon(file.name)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#888' }}>{(file.size / 1024 / 1024).toFixed(1)} МБ</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFile(null)}
                                style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', width: 32, height: 32, color: '#ef4444', cursor: 'pointer', flexShrink: 0, fontSize: '1rem' }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <label style={{ display: 'block', cursor: 'pointer' }}>
                            <div style={{ border: '2px dashed #c4b5fd', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', color: 'var(--color-primary)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📎</div>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Натисніть, щоб вибрати файл</p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#aaa' }}>Фото, PDF, Word, TXT — до 20МБ</p>
                            </div>
                            <input
                                type="file"
                                accept="image/*,.pdf,.doc,.docx,.txt"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </label>
                    )}

                    {error && (
                        <p style={{ margin: '8px 0 0', color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>
                    )}
                </div>

                {/* Upload progress */}
                {submitting && uploadProgress > 0 && (
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                            <span>Завантаження...</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--color-primary)', borderRadius: 4, transition: 'width 0.2s' }}></div>
                        </div>
                    </div>
                )}

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={(!text.trim() && !file) || submitting}
                    style={{
                        width: '100%', padding: '14px', border: 'none', borderRadius: '14px',
                        background: 'var(--color-primary)', color: 'white', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700,
                        opacity: (!text.trim() && !file) ? 0.5 : 1,
                        marginTop: 'auto'
                    }}
                >
                    {submitting ? 'Відправляємо...' : '📤 Відправити на перевірку'}
                </button>
            </form>
        </div>
    );
};

export default HomeworkSubmit;
