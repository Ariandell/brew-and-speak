import { useEffect, useState } from 'react';
import { useAppState } from '../app/AppState';

export function HomeworkAttachment({ assetId, fileName }: { assetId?: string; fileName: string }) {
    const { downloadAsset } = useAppState();
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        let created: string | undefined;
        setUrl(null); setError('');
        if (assetId) void downloadAsset(assetId).then(blob => {
            if (!active) return;
            created = URL.createObjectURL(blob); setUrl(created);
        }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Файл недоступний'); });
        return () => { active = false; if (created) URL.revokeObjectURL(created); };
    }, [assetId, downloadAsset]);
    return <div className="mt-3 text-[12px] font-bold text-accent-deep">
        {url ? <a href={url} download={fileName} className="underline">Завантажити: {fileName}</a>
            : <span>Файл: {fileName}{!assetId ? ' (приклад без вкладення)' : ' — завантаження…'}</span>}
        {error && <p role="alert" className="mt-1 text-alert">{error}</p>}
    </div>;
}
