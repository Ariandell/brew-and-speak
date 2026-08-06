import React from 'react';

// Any error thrown while rendering unmounts the whole tree, and the student is
// left staring at a blank white screen with nothing to act on. That is exactly
// what happened when the course endpoint answered with an error object instead
// of a list. Catch it and say something instead.

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Застосунок впав під час рендеру:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☕</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>Щось пішло не так</h1>
                <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 1.5rem', maxWidth: 320 }}>
                    Сталася помилка. Спробуйте оновити — якщо повториться, напишіть викладачці.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{ padding: '12px 28px', border: 'none', borderRadius: '14px', background: 'var(--color-primary)', color: 'white', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    Оновити
                </button>
            </div>
        );
    }
}
