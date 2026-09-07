import { useState } from 'react';
import { Field, inputClass } from '../../ui/ProductUI';

export const WordOrderEditor = ({ correctOrder, update }: { correctOrder: string[]; update: (patch: Record<string, unknown>) => void }) => {
    // Splitting the rendered value on every keypress otherwise eats typed spaces.
    const [sentence, setSentence] = useState(correctOrder.join(' '));
    return <Field label="Правильне речення" hint="слова перемішаються для учня автоматично">
        <textarea className={inputClass} rows={3} value={sentence} onChange={event => {
            const raw = event.target.value; setSentence(raw);
            const words = raw.trim().split(/\s+/).filter(Boolean);
            update({ correctOrder: words, words: [...words].sort() });
        }} />
    </Field>;
};
