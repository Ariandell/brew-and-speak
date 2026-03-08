import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/ui/BottomNav';
import { useUserId } from '../components/TelegramProvider';

const API = 'http://localhost:3000';

interface Message {
    id: number;
    sender_id: string;
    receiver_id: string;
    text: string;
    created_at: string;
    is_read: number;
}

export const Chat: React.FC = () => {
    const navigate = useNavigate();
    const CURRENT_USER_ID = useUserId();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial fetch and polling
    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const res = await fetch(`${API}/api/chat/${CURRENT_USER_ID}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setMessages(data);

                // Mark unread messages from admin as read
                const unreadAdmin = data.filter((m: Message) => m.sender_id === 'admin' && m.is_read === 0);
                if (unreadAdmin.length > 0) {
                    await fetch(`${API}/api/chat/read`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sender_id: 'admin', receiver_id: CURRENT_USER_ID })
                    });
                }
            } else {
                console.error("API did not return an array:", data);
            }
        } catch (e) {
            console.error('Failed to load chat', e);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inputText.trim() || sending) return;

        const textToSend = inputText.trim();
        setInputText(''); // Optimistically clear input
        setSending(true);

        // Optimistic UI update
        const optimisticMsg: Message = {
            id: Date.now(),
            sender_id: CURRENT_USER_ID,
            receiver_id: 'admin',
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
                    sender_id: CURRENT_USER_ID,
                    receiver_id: 'admin',
                    text: textToSend
                })
            });
            fetchMessages(); // Fetch real id and state
        } catch (e) {
            console.error('Failed to send message', e);
            // In a real app we'd show an error state
        } finally {
            setSending(false);
        }
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="page" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#e4e4e4' }}>
            {/* Telegram-style Header */}
            <header style={{
                padding: '0.6rem 1rem',
                backgroundColor: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: '1.1rem',
                        flexShrink: 0
                    }}>
                        О
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-main)', lineHeight: 1.2 }}>Ольга (Викладач)</h1>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-primary)', fontWeight: 500 }}>в мережі</p>
                    </div>
                </div>
            </header>

            {/* Chat Messages Area — Telegram wallpaper style */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.8rem',
                paddingBottom: '7rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                backgroundColor: '#e4e4e4' // Telegram light mode chat background
            }}>
                {!Array.isArray(messages) || messages.length === 0 ? (
                    <div style={{
                        margin: 'auto',
                        textAlign: 'center',
                        padding: '1.5rem 2rem',
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        borderRadius: '12px',
                        maxWidth: '80%'
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👋</div>
                        <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.3rem', fontSize: '0.95rem' }}>Тут ви можете задати питання викладачу.</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Напишіть своє перше повідомлення!</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.sender_id === CURRENT_USER_ID;
                        const showAvatar = !isMe && (index === messages.length - 1 || messages[index + 1]?.sender_id === CURRENT_USER_ID);

                        return (
                            <div key={msg.id} style={{
                                display: 'flex',
                                justifyContent: isMe ? 'flex-end' : 'flex-start',
                                alignItems: 'flex-end',
                                gap: '6px',
                                marginBottom: '2px'
                            }}>
                                {!isMe && (
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: showAvatar ? 'linear-gradient(135deg, #a78bfa, #8b5cf6)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0, color: 'white', fontWeight: 600 }}>
                                        {showAvatar ? 'О' : ''}
                                    </div>
                                )}

                                <div style={{
                                    maxWidth: '78%',
                                    background: isMe ? '#effdde' : '#ffffff', // Telegram classic: pale green for self, white for incoming
                                    color: 'var(--color-text-main)',
                                    padding: '7px 12px',
                                    borderRadius: '12px',
                                    borderBottomRightRadius: isMe ? '3px' : '12px',
                                    borderBottomLeftRadius: !isMe ? '3px' : '12px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                                    border: 'none'
                                }}>
                                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                        {msg.text}
                                    </p>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginTop: '3px'
                                    }}>
                                        <span style={{ fontSize: '0.7rem', color: '#aaa' }}>
                                            {formatTime(msg.created_at)}
                                        </span>
                                        {isMe && (
                                            <span style={{ fontSize: '0.75rem', color: msg.is_read ? '#4fc3f7' : '#aaa' }}>
                                                {msg.is_read ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
                onSubmit={handleSend}
                style={{
                    position: 'fixed',
                    bottom: '92px',
                    left: 0,
                    right: 0,
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(10px)',
                    borderTop: '1px solid rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    zIndex: 10
                }}
            >
                <div style={{
                    flex: 1,
                    backgroundColor: '#f0f2f5',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '9px 16px',
                    display: 'flex',
                    alignItems: 'center',
                }}>
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Написати повідомлення..."
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            fontSize: '0.95rem',
                            color: 'var(--color-text-main)',
                            fontFamily: 'inherit'
                        }}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: inputText.trim() ? 'var(--color-primary)' : '#c4c4c4',
                        color: 'white',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s ease',
                        cursor: inputText.trim() ? 'pointer' : 'default',
                        flexShrink: 0
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '2px' }}>
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </form>

            <BottomNav />
        </div>
    );
};

export default Chat;
