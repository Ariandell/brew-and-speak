import { useState } from 'react';
import type { LessonVocabulary } from '../../api/vocabularyContracts';
import { Button, Card, inputClass } from '../../ui/ProductUI';
import { useAppState } from '../../app/AppState';

const cardId = () => {
    const random = new Uint32Array(2); crypto.getRandomValues(random);
    return 1000000000000 + (random[0] % 1000000) * 4294967296 + random[1];
};
export const LessonVocabularyEditor = ({ lessonId, value, onChange }: { lessonId: number; value: LessonVocabulary; onChange: (value: LessonVocabulary) => void }) => {
    const { generateLessonVocabulary } = useAppState();
    const [generating, setGenerating] = useState(false);
    const [bulk, setBulk] = useState('');
    const [error, setError] = useState('');
    const change = (items: LessonVocabulary['items']) => onChange({ ...value, items });
    const importWords = () => {
        const lines = bulk.split(/\r?\n/).filter(line => line.trim());
        const parsed = lines.map(line => {
            const match = /^(.*?)\s*(?:\t|—|–|\s-\s|\s=\s)\s*(.+)$/.exec(line);
            return match && match[1].trim() && match[2].trim() ? { id: cardId(), front: match[1].trim(), back: match[2].trim() } : null;
        });
        if (parsed.some(item => !item)) { setError('Не всі рядки мають слово й переклад. Розділяйте їх тире — або табуляцією. Нічого не додано.'); return; }
        const seen = new Set(value.items.map(item => `${item.front.toLowerCase()}\t${item.back.toLowerCase()}`));
        const added = parsed.filter((item): item is NonNullable<typeof item> => {
            if (!item) return false;
            const key = `${item.front.toLowerCase()}\t${item.back.toLowerCase()}`;
            if (seen.has(key)) return false; seen.add(key); return true;
        });
        change([...value.items, ...added]); setBulk(''); setError('');
    };
    return <Card className="mt-5 space-y-4 p-4">
        <h2 id="lesson-vocabulary" className="text-xl font-black">📖 Словник уроку ({value.items.length} слів)</h2>
        <p className="text-sm text-text-soft">Збережені слова автоматично стають картками учнів, коли їм доступний урок. Прогрес наявних карток зберігається.</p>
        {value.items.map((item, index) => <div key={item.id} className="flex items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">{(['front', 'back'] as const).map(side => <input key={side} value={item[side]} aria-label={`${side === 'front' ? 'Слово' : 'Переклад'} ${index + 1}`} placeholder={side === 'front' ? 'Слово англійською' : 'Переклад'} className={inputClass}
                onChange={event => change(value.items.map(row => row.id === item.id ? { ...row, [side]: event.target.value } : row))} />)}</div>
            <button type="button" aria-label={`Видалити слово ${index + 1}`} className="h-11 w-8 text-alert" onClick={() => change(value.items.filter(row => row.id !== item.id))}>×</button>
        </div>)}
        <Button tone="secondary" onClick={() => change([...value.items, { id: cardId(), front: '', back: '' }])}>+ Додати слово</Button>
        <Button tone="secondary" disabled={generating} onClick={() => {
            setGenerating(true); setError('');
            void generateLessonVocabulary(lessonId).then(result => {
                setBulk(result.items.map(item => `${item.front} — ${item.back}`).join('\n'));
            }).catch(reason => setError(reason instanceof Error ? reason.message : 'Не вдалося згенерувати слова.')).finally(() => setGenerating(false));
        }}>{generating ? 'Генеруємо…' : 'Згенерувати зі збереженого уроку'}</Button>
        {error && <p role="alert" className="text-sm text-alert">{error}</p>}
        <details open={bulk ? true : undefined}><summary className="cursor-pointer text-sm font-bold text-accent">Вставити список слів / з таблиці</summary>
            <textarea aria-label="Список слів" rows={6} className={`${inputClass} mt-3`} value={bulk} onChange={event => setBulk(event.target.value)} placeholder={'happy — щасливий\nexcited — схвильований'} />
            <p className="my-2 text-xs text-text-soft">Один рядок — одна картка. Можна вставити дві колонки з таблиці.</p>
            <Button tone="secondary" disabled={!bulk.trim()} onClick={importWords}>Додати список</Button>
        </details>
    </Card>;
};
