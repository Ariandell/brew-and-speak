import React from 'react';

/**
 * A render error unmounts the whole tree and leaves a blank white screen with
 * nothing to press. That happened in the previous app and cost a day to find,
 * so the boundary is here from the first screen rather than added after.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Застосунок впав під час рендеру:', error, info.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-sand px-8 text-center">
                <div className="text-5xl">☕</div>
                <h1 className="text-xl font-black italic uppercase text-ink">Щось пішло не так</h1>
                <p className="text-sm text-ink-soft">Спробуйте оновити сторінку.</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-2 -skew-x-12 bg-blue-hot px-6 py-3 font-black uppercase italic text-paper shadow-[6px_6px_0_#0F1B33]"
                >
                    Оновити
                </button>
            </div>
        );
    }
}
