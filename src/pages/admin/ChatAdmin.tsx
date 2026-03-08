import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

const API = '';

interface Conversation {
    user_id: string;
    user_name: string;
    last_activity: string;
    unread_count: number;
    last_message: string;
}

interface Message {
    id: number;
    sender_id: string;
    receiver_id: string;
    text: string;
    created_at: string;
    is_read: number;
}

export const ChatAdmin: React.FC = () => {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeUser, setActiveUser] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollingRef = useRef<number | null>(null);

    // Fetch conversations list
    const fetchConversations = async () => {
        try {
            const res = await fetch(`${API}/api/chat/admin/conversations`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setConversations(data);
            } else {
                console.error('Conversations API returned non-array:', data);
                setConversations([]);
            }
        } catch (e) {
            console.error('Failed to load conversations', e);
        }
    };

    // Fetch messages for active user
    const fetchMessages = async () => {
        if (!activeUser) return;
        try {
            const res = await fetch(`${API}/api/chat/${activeUser}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setMessages(data);

                // Mark student messages as read
                const unread = data.filter((m: Message) => m.sender_id === activeUser && m.is_read === 0);
                if (unread.length > 0) {
                    await fetch(`${API}/api/chat/read`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sender_id: activeUser, receiver_id: 'admin' })
                    });
                    fetchConversations(); // Update unread counts
                }
            } else {
                console.error('Messages API returned non-array:', data);
                setMessages([]);
            }
        } catch (e) {
            console.error('Failed to load messages', e);
        }
    };

    // Setup polling
    useEffect(() => {
        fetchConversations();
        const interval = setInterval(() => {
            fetchConversations();
            if (activeUser) fetchMessages();
        }, 3000);
        pollingRef.current = interval as any;

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [activeUser]);

    // Initial load of messages when switching users
    useEffect(() => {
        if (activeUser) {
            fetchMessages();
        } else {
            setMessages([]);
        }
    }, [activeUser]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !activeUser || sending) return;

        const textToSend = inputText.trim();
        setInputText('');
        setSending(true);

        const optimisticMsg: Message = {
            id: Date.now(),
            sender_id: 'admin',
            receiver_id: activeUser,
            text: textToSend,
            created_at: new Date().toISOString(),
            is_read: 0
        };
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            await fetch(`${API}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender_id: 'admin',
                    receiver_id: activeUser,
                    text: textToSend
                })
            });
            fetchMessages();
            fetchConversations();
        } catch (e) {
            console.error('Failed to send message', e);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (new Date().toDateString() === d.toDateString()) {
            return formatTime(dateStr);
        }
        return d.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' });
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-subtle)' }}>
            <header className="page-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 1rem',
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                color: 'var(--color-text-main)',
                zIndex: 10
            }}>
                <button
                    className="btn-back-header"
                    onClick={() => navigate('/admin')}
                    style={{
                        color: 'var(--color-primary)',
                        background: 'transparent',
                        padding: '8px 4px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500,
                        fontSize: '1rem',
                        transition: 'opacity 0.2s',
                        width: '80px'
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    <span>Назад</span>
                </button>
                <h1 style={{
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    margin: 0,
                    textAlign: 'center',
                    flex: 1,
                    color: 'var(--color-text-main)'
                }}>
                    Чат
                </h1>
                <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', paddingRight: '12px' }}>
                    {/* Placeholder for potential header actions (e.g. search, settings) */}
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '1.5rem 2rem' }} className="admin-chat-layout">
                <Card style={{
                    flex: 1,
                    display: 'flex',
                    overflow: 'hidden',
                    borderRadius: '24px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    padding: 0
                }}>

                    {/* Left Sidebar - Conversations */}
                    <div className={`admin-chat-sidebar ${activeUser ? 'hidden-on-mobile' : ''}`} style={{
                        borderRight: '1px solid rgba(0,0,0,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'white',
                        zIndex: 2
                    }}>
                        <div style={{ padding: '0.8rem 1.2rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', backgroundColor: '#fafafa' }}>
                            <div className="input-modern" style={{ padding: '0.6rem 1rem', borderRadius: '12px', flex: 1, fontSize: '0.9rem', color: 'var(--color-text-muted)', backgroundColor: '#f0f2f5', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                Пошук
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {!Array.isArray(conversations) || conversations.length === 0 ? (
                                <p style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    Ще немає активних діалогів
                                </p>
                            ) : (
                                conversations.map(conv => {
                                    const isActive = activeUser === conv.user_id;
                                    return (
                                        <div
                                            key={conv.user_id}
                                            onClick={() => setActiveUser(conv.user_id)}
                                            style={{
                                                padding: '0.6rem 0.8rem',
                                                cursor: 'pointer',
                                                backgroundColor: isActive ? 'var(--color-primary)' : 'white',
                                                color: isActive ? 'white' : 'inherit',
                                                transition: 'background-color 0.15s ease',
                                                display: 'flex',
                                                gap: '12px',
                                                alignItems: 'center',
                                                margin: '4px 8px',
                                                borderRadius: '12px'
                                            }}
                                        >
                                            {/* Avatar container */}
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '50%',
                                                background: isActive ? 'rgba(255,255,255,0.2)' : 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: '1.2rem',
                                                flexShrink: 0
                                            }}>
                                                {(conv.user_name || conv.user_id).substring(0, 1).toUpperCase()}
                                            </div>

                                            {/* Content container */}
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        color: isActive ? 'white' : 'var(--color-text-main)',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        fontSize: '1rem'
                                                    }}>
                                                        {conv.user_name || conv.user_id}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)',
                                                        flexShrink: 0,
                                                        marginLeft: '8px'
                                                    }}>
                                                        {formatDate(conv.last_activity)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{
                                                        fontSize: '0.9rem',
                                                        color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--color-text-muted)',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        flex: 1,
                                                        marginRight: '12px'
                                                    }}>
                                                        {conv.last_message}
                                                    </span>
                                                    {conv.unread_count > 0 && (
                                                        <span style={{
                                                            backgroundColor: isActive ? 'white' : 'var(--color-primary)',
                                                            color: isActive ? 'var(--color-primary)' : 'white',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            minWidth: '22px',
                                                            height: '22px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: '11px',
                                                            padding: '0 6px',
                                                            flexShrink: 0
                                                        }}>
                                                            {conv.unread_count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Area - Chat */}
                    <div className={`admin-chat-area ${!activeUser ? 'hidden-on-mobile' : ''}`} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'var(--color-bg-subtle)',
                        backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
                        backgroundSize: '24px 24px'
                    }}>
                        {activeUser ? (
                            <>
                                {/* Chat Header */}
                                <div style={{
                                    padding: '0.8rem 1.2rem',
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    backdropFilter: 'blur(10px)',
                                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    zIndex: 1
                                }}>
                                    <button
                                        className="btn-back-sidebar"
                                        onClick={() => setActiveUser(null)}
                                        style={{
                                            background: 'none', border: 'none', padding: '8px', marginLeft: '-8px',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                                            color: 'var(--color-primary)', marginRight: '4px'
                                        }}
                                        aria-label="Back to conversations"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                    </button>
                                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 600, flexShrink: 0 }}>
                                        {conversations.find(c => c.user_id === activeUser)?.user_name?.substring(0, 1)?.toUpperCase() || activeUser.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
                                            {conversations.find(c => c.user_id === activeUser)?.user_name || activeUser}
                                        </h3>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 500, marginTop: '2px' }}>
                                            в мережі
                                        </div>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {messages.map(msg => {
                                        const isAdmin = msg.sender_id === 'admin';
                                        return (
                                            <div key={msg.id} style={{
                                                display: 'flex',
                                                justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                                            }}>
                                                <div style={{
                                                    maxWidth: '80%',
                                                    padding: '8px 12px',
                                                    background: isAdmin ? '#e3f2fd' : 'white', // Telegram like pale blue for self, white for others
                                                    color: 'var(--color-text-main)',
                                                    borderRadius: '16px',
                                                    borderBottomRightRadius: isAdmin ? '4px' : '16px',
                                                    borderBottomLeftRadius: !isAdmin ? '4px' : '16px',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                                    border: 'none',
                                                    display: 'flex',
                                                    flexDirection: 'column'
                                                }}>
                                                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.4, wordBreak: 'break-word' }}>{msg.text}</p>
                                                    <div style={{
                                                        textAlign: 'right',
                                                        marginTop: '6px',
                                                        fontSize: '0.75rem',
                                                        color: isAdmin ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)',
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        {formatTime(msg.created_at)}
                                                        {isAdmin && <span style={{ marginLeft: '4px', color: msg.is_read ? '#6ee7b7' : 'inherit' }}>{msg.is_read ? '✓✓' : '✓'}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <form onSubmit={handleSend} style={{
                                    padding: '1.2rem 1.5rem',
                                    backgroundColor: 'white',
                                    borderTop: '1px solid rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    gap: '12px',
                                    zIndex: 1
                                }}>
                                    <div style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        backgroundColor: 'var(--color-bg-subtle)',
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        borderRadius: '24px',
                                        padding: '10px 20px',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <input
                                            type="text"
                                            value={inputText}
                                            onChange={e => setInputText(e.target.value)}
                                            placeholder="Написати повідомлення студенту..."
                                            style={{
                                                flex: 1,
                                                border: 'none',
                                                outline: 'none',
                                                background: 'transparent',
                                                fontSize: '1rem',
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!inputText.trim() || sending}
                                        style={{
                                            width: '48px', height: '48px', borderRadius: '50%', border: 'none',
                                            background: inputText.trim() ? 'linear-gradient(135deg, var(--color-primary), #9333ea)' : 'var(--color-border)',
                                            color: 'white', cursor: inputText.trim() ? 'pointer' : 'default',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            transform: inputText.trim() ? 'scale(1.05)' : 'scale(1)',
                                            boxShadow: inputText.trim() ? '0 4px 15px rgba(124, 58, 237, 0.3)' : 'none'
                                        }}
                                    >
                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-2px', transition: 'transform 0.2s', transform: inputText.trim() ? 'translateX(2px)' : 'none' }}>
                                            <line x1="22" y1="2" x2="11" y2="13"></line>
                                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                        </svg>
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-text-muted)',
                                flexDirection: 'column',
                                gap: '1.5rem'
                            }}>
                                <div style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(124, 58, 237, 0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '4rem',
                                    boxShadow: 'inset 0 10px 20px rgba(0,0,0,0.02)'
                                }}>
                                    👋
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text)' }}>Немає вибраного діалогу</p>
                                    <p style={{ margin: '8px 0 0', fontSize: '0.95rem' }}>Оберіть студента зі списку зліва, щоб <br /> почати спілкування</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ChatAdmin;
