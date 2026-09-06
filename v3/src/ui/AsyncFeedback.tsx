import { useEffect, useRef } from 'react';

export const asyncErrorMessage = (reason: unknown, fallback: string) => {
    if (reason instanceof Error && reason.message.trim()) return reason.message;
    return fallback;
};

export const useMountedRef = () => {
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    return mounted;
};

export const AsyncFeedback = ({ error, success }: { error?: string; success?: string }) => {
    if (error) return <p role="alert" className="rounded-[12px] bg-alert/8 px-3 py-2 text-[11px] font-bold text-alert">{error}</p>;
    if (success) return <p role="status" className="rounded-[12px] bg-good/10 px-3 py-2 text-[11px] font-bold text-good">{success}</p>;
    return null;
};
