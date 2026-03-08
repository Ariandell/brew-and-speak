import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const API = '''';

interface PhotoMessage {
    id: number;
    image_url: string;
    caption: string;
    scheduled_at: string;
    created_at: string;
}

// SVG Icons
const MailPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"></path>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
        <path d="M19 16v6"></path>
        <path d="M16 19h6"></path>
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
    </svg>
);

const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
        <circle cx="9" cy="9" r="2"></circle>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
    </svg>
);

const PhotoMessageEditor: React.FC = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<PhotoMessage[]>([]);
    const [caption, setCaption] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchMessages();
    }, []);

    const fetchMessages = async () => {
        try {
            const res = await fetch(`${API}/api/photo-messages`);
            const data = await res.json();
            setMessages(data);
        } catch (e) {
            console.error('Failed to load messages', e);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile) return;
        setSending(true);

        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('caption', caption);

        try {
            await fetch(`${API}/api/photo-messages`, { method: 'POST', body: formData });
            setCaption('');
            setSelectedFile(null);
            setPreview(null);
            fetchMessages();
        } catch (e) {
            console.error('Failed to send', e);
        }
        setSending(false);
    };

    const handleDelete = async (id: number) => {
        try {
            await fetch(`${API}/api/photo-messages/${id}`, { method: 'DELETE' });
            fetchMessages();
        } catch (e) {
            console.error('Failed to delete', e);
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="page" style={{ paddingBottom: '2rem' }}>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <button className="btn-back-header" onClick={() => navigate('/admin')} style={{ color: 'var(--color-primary)' }}>‹ Назад</button>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>📨 Фото-повідомлення</h1>
                <div style={{ width: 60 }}></div>
            </header>

            {/* Upload Form */}
            <Card style={{ padding: '1.5rem', marginBottom: '2rem', border: 'none', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-lg)' }}>
                <h3 style={{ fontWeight: 800, marginBottom: '1.25rem', fontSize: '1.1rem' }}>Нове повідомлення</h3>

                {/* Image Upload */}
                <div
                    onClick={() => document.getElementById('photo-upload')?.click()}
                    style={{
                        border: '2px dashed var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: preview ? '0' : '2rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        marginBottom: '1rem',
                        overflow: 'hidden',
                        backgroundColor: 'var(--color-surface)',
                        transition: 'border-color 0.2s',
                        position: 'relative',
                    }}
                >
                    {preview ? (
                        <img src={preview} alt="Preview" style={{ width: '100%', display: 'block', borderRadius: 'var(--radius-md)' }} />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)' }}>
                            <ImageIcon />
                            <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Натисніть щоб обрати фото</span>
                        </div>
                    )}
                    <input id="photo-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </div>

                {/* Caption */}
                <textarea
                    className="input-modern"
                    placeholder="Підпис до фото (необов'язково)..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={3}
                    style={{ width: '100%', marginBottom: '1rem', resize: 'vertical', fontFamily: 'inherit' }}
                />

                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!selectedFile || sending}
                    style={{ width: '100%', opacity: (!selectedFile) ? 0.5 : 1 }}
                >
                    {sending ? 'Надсилаємо...' : '📨 Надіслати всім'}
                </Button>
            </Card>

            {/* Existing Messages */}
            <h3 style={{ fontWeight: 800, marginBottom: '1rem', fontSize: '1.1rem' }}>Відправлені повідомлення</h3>
            {messages.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>Немає повідомлень</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map(msg => {
                    return (
                        <Card key={msg.id} style={{
                            padding: '1rem',
                            border: 'none',
                            boxShadow: 'var(--shadow-sm)',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'center',
                        }}>
                            <img
                                src={`${API}${msg.image_url}`}
                                alt=""
                                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {msg.caption || '(без підпису)'}
                                </p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-success)', margin: '0.2rem 0 0', fontWeight: 600 }}>
                                    ✓ Надіслано
                                </p>
                            </div>
                            <button
                                onClick={() => handleDelete(msg.id)}
                                style={{
                                    background: '#fee2e2',
                                    border: 'none',
                                    borderRadius: '12px',
                                    width: 40,
                                    height: 40,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#e11d48',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                }}
                            >
                                <TrashIcon />
                            </button>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default PhotoMessageEditor;
