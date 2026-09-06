import type { LessonBlock } from '../api/contracts';
import type { ProductCard, ProductLesson } from './productTypes';

export const RETAKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const isLessonOpen = (lesson: ProductLesson, now = Date.now()): boolean => {
    if (lesson.status === 'available') return true;
    if (lesson.status === 'locked') return Boolean(lesson.unlocksAt && Date.parse(lesson.unlocksAt) <= now);
    return Boolean(lesson.completedAt && Date.parse(lesson.completedAt) + RETAKE_COOLDOWN_MS <= now);
};

export const lessonAccessMessage = (lesson: ProductLesson, now = Date.now()): string | null => {
    if (isLessonOpen(lesson, now)) return null;
    if (lesson.status === 'completed' && lesson.completedAt) {
        return `Повторне проходження відкриється ${new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(Date.parse(lesson.completedAt) + RETAKE_COOLDOWN_MS))}`;
    }
    if (lesson.unlocksAt) {
        return `Відкриється ${new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(lesson.unlocksAt))}`;
    }
    return 'Відкриється після попереднього уроку';
};

export const reviewSrsCard = (card: ProductCard, correct: boolean, now = Date.now()): ProductCard => {
    const timesShown = card.timesShown + 1;
    const timesCorrect = card.timesCorrect + (correct ? 1 : 0);
    const timesWrong = card.timesWrong + (correct ? 0 : 1);
    const easeFactor = Math.max(1.3, Number((card.easeFactor + (correct ? 0.1 : -0.2)).toFixed(2)));
    let intervalDays = 0;
    if (correct) {
        if (card.intervalDays <= 0) intervalDays = 1;
        else if (card.intervalDays === 1) intervalDays = 3;
        else intervalDays = Math.max(1, Math.round(card.intervalDays * easeFactor));
    }
    return {
        ...card,
        due: !correct,
        state: correct && timesCorrect >= 3 ? 'learned' : 'learning',
        timesShown,
        timesCorrect,
        timesWrong,
        easeFactor,
        intervalDays,
        nextReviewAt: new Date(now + intervalDays * 86400000).toISOString(),
    };
};

export interface DraftIssue {
    blockId: number | null;
    message: string;
}

const clean = (value: string) => value.trim();

export const validateLessonDraft = (title: string, blocks: LessonBlock[]): DraftIssue[] => {
    const issues: DraftIssue[] = [];
    if (!clean(title)) issues.push({ blockId: null, message: 'Додай назву уроку.' });
    if (!blocks.length) issues.push({ blockId: null, message: 'Урок має містити хоча б один блок.' });
    const ids = new Set<number>();
    for (const block of blocks) {
        if (ids.has(block.id)) issues.push({ blockId: block.id, message: 'Блок має неунікальний ID.' });
        ids.add(block.id);
        if (block.type === 'text' && !clean(block.html.replace(/<[^>]+>/g, ''))) issues.push({ blockId: block.id, message: 'Текстовий блок порожній.' });
        if (block.type === 'mascot_tip' && !clean(block.html.replace(/<[^>]+>/g, ''))) issues.push({ blockId: block.id, message: 'Підказка маскота порожня.' });
        if (block.type === 'quiz') {
            const options = block.options.map(clean);
            if (!clean(block.question)) issues.push({ blockId: block.id, message: 'Додай питання тесту.' });
            if (options.length < 2 || options.some(option => !option)) issues.push({ blockId: block.id, message: 'Тесту потрібно щонайменше два непорожні варіанти.' });
            if (!options.includes(clean(block.correctOption))) issues.push({ blockId: block.id, message: 'Правильна відповідь має бути серед варіантів.' });
        }
        if (block.type === 'fill_blank') {
            const options = block.options.map(clean);
            if (!/_+/.test(block.sentence)) issues.push({ blockId: block.id, message: 'У реченні немає пропуску з підкреслень.' });
            if (!options.length || options.some(option => !option)) issues.push({ blockId: block.id, message: 'Варіанти відповіді не можуть бути порожніми.' });
            if (!options.includes(clean(block.correctAnswer))) issues.push({ blockId: block.id, message: 'Правильна відповідь має бути серед варіантів.' });
        }
        if (block.type === 'word_order') {
            const expected = [...block.words].sort().join('\u0000');
            const actual = [...block.correctOrder].sort().join('\u0000');
            if (block.words.length < 2 || expected !== actual) issues.push({ blockId: block.id, message: 'Правильний порядок має містити ті самі слова, що й набір.' });
        }
        if (block.type === 'match_pairs' && (!block.pairs.length || block.pairs.some(pair => !clean(pair.left) || !clean(pair.right)))) {
            issues.push({ blockId: block.id, message: 'Кожна пара має містити слово і відповідник.' });
        }
        if (block.type === 'homework' && !clean(block.promptHtml.replace(/<[^>]+>/g, ''))) issues.push({ blockId: block.id, message: 'Умова домашнього завдання порожня.' });
        if ((block.type === 'audio' || block.type === 'photo') && !clean(block.assetId)) issues.push({ blockId: block.id, message: 'Оберіть медіафайл.' });
    }
    return issues;
};

export const nextBlockId = (blocks: LessonBlock[]): number => Math.max(Date.now(), ...blocks.map(block => block.id + 1));

export const createLessonBlock = (type: LessonBlock['type'], id: number, order: number): LessonBlock => {
    switch (type) {
        case 'text': return { id, order, type, html: '<p>Новий текстовий блок</p>' };
        case 'audio': return { id, order, type, assetId: '', title: '' };
        case 'photo': return { id, order, type, assetId: '', alt: '' };
        case 'mascot_tip': return { id, order, type, html: '<p>Нова підказка</p>', mood: 'neutral' };
        case 'quiz': return { id, order, type, question: '', options: ['', ''], correctOption: '' };
        case 'fill_blank': return { id, order, type, sentence: 'She ___ coffee.', options: ['', ''], correctAnswer: '' };
        case 'true_false': return { id, order, type, statement: '', correct: true };
        case 'word_order': return { id, order, type, words: [], correctOrder: [] };
        case 'match_pairs': return { id, order, type, pairs: [{ left: '', right: '' }] };
        case 'homework': return { id, order, type, promptHtml: '<p>Опиши завдання для учня.</p>' };
        case 'unsupported': return { id, order, type, reason: 'Невідомий legacy-блок' };
    }
};
