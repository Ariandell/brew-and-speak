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
            <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-paper px-8 text-center">
                <div className="text-5xl">☕</div>
                <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Щось пішло не так</h1>
                <p className="text-[15px] font-medium text-ink-soft">Спробуйте оновити сторінку.</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-2 rounded-pill bg-blue px-7 py-3.5 text-[16px] font-extrabold text-paper shadow-accent transition-all duration-150 ease-soft active:translate-y-[2px] active:scale-[0.985] active:shadow-accent-press"
                >
                    Оновити
                </button>
            </div>
        );
    }
}
