import { useEffect, useState } from 'react';
import { useAppState } from '../app/AppState';

const useAssetUrl = (assetId: string) => {
    const { downloadAsset } = useAppState();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true; let created = '';
        setUrl(null); setError('');
        void downloadAsset(assetId).then(blob => {
            if (!active) return;
            created = URL.createObjectURL(blob); setUrl(created);
        }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Медіафайл недоступний.'); });
        return () => { active = false; if (created) URL.revokeObjectURL(created); };
    }, [assetId, downloadAsset]);
    return { url, error };
};

export const AuthenticatedImage = ({ assetId, alt }: { assetId: string; alt: string }) => {
    const { url, error } = useAssetUrl(assetId);
    if (error) return <p role="alert" className="rounded-[14px] bg-alert/10 p-4 text-center text-[11px] font-bold text-alert">{error}</p>;
    if (!url) return <div className="h-44 animate-pulse rounded-[14px] bg-accent-tint/60" aria-label="Завантаження зображення" />;
    return <img src={url} alt={alt} className="max-h-[65dvh] w-full rounded-[14px] object-contain" />;
};

export const AuthenticatedAudio = ({ assetId }: { assetId: string }) => {
    const { url, error } = useAssetUrl(assetId);
    if (error) return <p role="alert" className="rounded-[12px] bg-alert/10 p-3 text-[11px] font-bold text-alert">{error}</p>;
    return url ? <audio className="w-full" controls preload="metadata" src={url}><track kind="captions" /></audio>
        : <div className="h-12 animate-pulse rounded-[12px] bg-accent-tint/60" aria-label="Завантаження аудіо" />;
};
