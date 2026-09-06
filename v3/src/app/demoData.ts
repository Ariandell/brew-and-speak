import type { LessonBlock } from '../api/contracts';
import type { ProductState } from './productTypes';

const lessonOneBlocks: LessonBlock[] = [
    { id: 101, order: 0, type: 'text', html: '<h2>Коли використовуємо Present Perfect</h2><p>Говоримо про досвід або результат, важливий зараз.</p>' },
    { id: 102, order: 1, type: 'mascot_tip', mood: 'happy', html: '<b>Підказка:</b> шукай зв’язок минулої дії з теперішнім.' },
    { id: 103, order: 2, type: 'quiz', question: 'Оберіть правильне речення', options: ['I have finished my coffee.', 'I has finished my coffee.', 'I finishing my coffee.'], correctOption: 'I have finished my coffee.' },
    { id: 104, order: 3, type: 'fill_blank', sentence: 'She ___ already arrived.', options: ['has', 'have', 'is'], correctAnswer: 'has' },
    { id: 105, order: 4, type: 'true_false', statement: 'Present Perfect завжди називає точний час у минулому.', correct: false },
    { id: 106, order: 5, type: 'word_order', words: ['ever', 'you', 'Have', 'London?', 'visited'], correctOrder: ['Have', 'you', 'ever', 'visited', 'London?'] },
    { id: 107, order: 6, type: 'match_pairs', pairs: [{ left: 'already', right: 'вже' }, { left: 'yet', right: 'ще' }, { left: 'ever', right: 'коли-небудь' }] },
    { id: 108, order: 7, type: 'homework', promptHtml: '<p>Напиши 5 речень про те, що ти вже зробив або ще не зробив цього тижня.</p>' },
];

const simpleBlocks = (id: number, title: string): LessonBlock[] => [
    { id: id * 100 + 1, order: 0, type: 'text', html: `<h2>${title}</h2><p>Коротке пояснення, приклади та практика в одному темпі.</p>` },
    { id: id * 100 + 2, order: 1, type: 'quiz', question: 'Оберіть природний варіант', options: ['That sounds great.', 'That sound greatly.', 'It great sounds.'], correctOption: 'That sounds great.' },
];

export const createDemoState = (role: 'student' | 'teacher'): ProductState => ({
    currentUser: {
        id: role === 'teacher' ? 900 : 101,
        name: role === 'teacher' ? 'Викладачка' : 'Андрій',
        username: role === 'teacher' ? 'english_coffee_teacher' : 'ariandell',
        role,
        isBlocked: false,
        courseId: 1,
        streakDays: 7,
    },
    courses: [
        { id: 1, title: 'Intermediate English', description: 'Жива англійська для впевненого спілкування.', level: 'B1', order: 1 },
        { id: 2, title: 'English Foundations', description: 'Системна база для початку навчання.', level: 'A1–A2', order: 2 },
    ],
    lessons: [
        { id: 1, courseId: 1, order: 1, title: 'Present Perfect', subtitle: 'Досвід і результат', durationMinutes: 18, status: 'available', unlocksAt: null, completedAt: null, score: null, revision: 1, blocks: lessonOneBlocks },
        { id: 2, courseId: 1, order: 2, title: 'Already, yet, just', subtitle: 'Маркери часу', durationMinutes: 15, status: 'locked', unlocksAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(), completedAt: null, score: null, revision: 1, blocks: simpleBlocks(2, 'Already, yet, just') },
        { id: 3, courseId: 1, order: 3, title: 'Life experience', subtitle: 'Have you ever…?', durationMinutes: 20, status: 'locked', unlocksAt: null, completedAt: null, score: null, revision: 1, blocks: simpleBlocks(3, 'Life experience') },
        { id: 4, courseId: 1, order: 4, title: 'Conversations', subtitle: 'Розмовна практика', durationMinutes: 16, status: 'locked', unlocksAt: null, completedAt: null, score: null, revision: 1, blocks: simpleBlocks(4, 'Conversations') },
        { id: 5, courseId: 2, order: 1, title: 'Nice to meet you', subtitle: 'Знайомство', durationMinutes: 12, status: 'available', unlocksAt: null, completedAt: null, score: null, revision: 1, blocks: simpleBlocks(5, 'Nice to meet you') },
    ],
    results: [],
    homework: [
        { id: 'hw-previous', studentId: 101, lessonId: 4, promptHtml: '<p>Запиши короткий діалог у кав’ярні.</p>', answer: 'A short dialogue about ordering coffee.', fileName: null, status: 'graded', grade: 9, comment: 'Дуже природно. Зверни увагу на артикль перед cappuccino.', submittedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
        { id: 'hw-pending', studentId: 102, lessonId: 1, promptHtml: lessonOneBlocks[7].type === 'homework' ? lessonOneBlocks[7].promptHtml : '', answer: 'I have finished my project. I have not visited the gym yet.', fileName: 'homework-week.docx', status: 'pending', grade: null, comment: null, submittedAt: new Date(Date.now() - 3600000).toISOString() },
    ],
    cards: [
        { id: 1, lessonId: 1, front: 'already', back: 'вже', example: 'I have already finished.', state: 'new', due: true, timesShown: 0, timesCorrect: 0, timesWrong: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: null },
        { id: 2, lessonId: 1, front: 'yet', back: 'ще / вже', example: 'Have you finished yet?', state: 'new', due: true, timesShown: 0, timesCorrect: 0, timesWrong: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: null },
        { id: 3, lessonId: 1, front: 'ever', back: 'коли-небудь', example: 'Have you ever been there?', state: 'new', due: true, timesShown: 0, timesCorrect: 0, timesWrong: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: null },
        { id: 4, lessonId: 4, front: 'receipt', back: 'чек', example: 'Could I have the receipt?', state: 'new', due: true, timesShown: 0, timesCorrect: 0, timesWrong: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: null },
        { id: 5, lessonId: 4, front: 'recommend', back: 'рекомендувати', example: 'What do you recommend?', state: 'new', due: true, timesShown: 0, timesCorrect: 0, timesWrong: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: null },
    ],
    messages: [
        { id: 'msg-1', studentId: 101, from: 'teacher', body: 'Привіт! Як тобі новий урок?', createdAt: new Date(Date.now() - 7200000).toISOString(), read: true },
        { id: 'msg-2', studentId: 101, from: 'student', body: 'Подобається, особливо короткі вправи.', createdAt: new Date(Date.now() - 6900000).toISOString(), read: true },
        { id: 'msg-3', studentId: 102, from: 'student', body: 'Можна перевірити моє домашнє?', createdAt: new Date(Date.now() - 1800000).toISOString(), read: false },
    ],
    students: [
        { id: 101, name: 'Андрій', username: 'ariandell', courseId: 1, isBlocked: false, completedLessons: 5, totalLessons: 18, averageScore: 8.7, lastActive: new Date(Date.now() - 120000).toISOString() },
        { id: 102, name: 'Марія', username: 'maria_english', courseId: 1, isBlocked: false, completedLessons: 7, totalLessons: 18, averageScore: 9.2, lastActive: new Date(Date.now() - 3600000).toISOString() },
        { id: 103, name: 'Олексій', username: null, courseId: 2, isBlocked: true, completedLessons: 1, totalLessons: 12, averageScore: 7, lastActive: new Date(Date.now() - 5 * 86400000).toISOString() },
        { id: 104, name: 'Новий учень', username: null, courseId: null, isBlocked: false, completedLessons: 0, totalLessons: 0, averageScore: null, lastActive: new Date().toISOString() },
    ],
    broadcasts: [
        { id: 'photo-1', caption: 'Нове слово дня вже чекає ☕', imageName: 'word-of-the-day.jpg', scheduledAt: new Date(Date.now() - 86400000).toISOString(), status: 'sent', viewedBy: [] },
    ],
    lessonAttempts: {},
    lessonProgress: {
        101: { 4: { status: 'completed', unlocksAt: null, completedAt: new Date(Date.now() - 2 * 86400000).toISOString(), score: 9 } },
    },
    cardProgress: {
        101: {
            1: { state: 'learning', due: true, timesShown: 3, timesCorrect: 2, timesWrong: 1, easeFactor: 2.3, intervalDays: 1, nextReviewAt: new Date(Date.now() - 3600000).toISOString() },
            3: { state: 'learning', due: true, timesShown: 2, timesCorrect: 1, timesWrong: 1, easeFactor: 2.3, intervalDays: 1, nextReviewAt: new Date(Date.now() - 7200000).toISOString() },
            4: { state: 'learned', due: false, timesShown: 8, timesCorrect: 7, timesWrong: 1, easeFactor: 2.8, intervalDays: 8, nextReviewAt: new Date(Date.now() + 8 * 86400000).toISOString() },
            5: { state: 'learning', due: true, timesShown: 5, timesCorrect: 3, timesWrong: 2, easeFactor: 2.2, intervalDays: 3, nextReviewAt: new Date(Date.now() - 86400000).toISOString() },
        },
    },
});
