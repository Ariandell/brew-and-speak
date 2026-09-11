import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LessonBlock, RecordAttemptAnswerRequest } from '../api/contracts';
import { createDemoState } from './demoData';
import type { LessonVocabulary } from '../api/vocabularyContracts';
import type { AppRoute } from './routes';
import { routeFromPath, routePath } from './routes';
import type { LessonResult, ProductBroadcast, ProductHomework, ProductState, ProductUser } from './productTypes';
import { reviewSrsCard } from './domain';
import { toPlainText } from '../lib/plainText';
import { createDemoProductRepository } from './productRepository';
import { readDemoAttachment, saveDemoAttachment } from './demoAttachments';

const requestedRole = (): ProductUser['role'] => {
    const requested = new URLSearchParams(window.location.search).get('demo');
    return requested === 'teacher' ? 'teacher' : 'student';
};

const requestedStudentId = (): number => {
    const requested = new URLSearchParams(window.location.search).get('demo');
    if (requested === 'student-b') return 102;
    if (requested === 'blocked') return 103;
    if (requested === 'new-student') return 104;
    return 101;
};

const hydrateState = (stored: ProductState, role: ProductUser['role']): ProductState => {
    const fresh = createDemoState(role);
    const studentId = requestedStudentId();
    const student = stored.students?.find(item => item.id === studentId) ?? fresh.students.find(item => item.id === studentId);
    const currentUser = role === 'teacher' ? fresh.currentUser : {
        ...fresh.currentUser,
        id: student?.id ?? fresh.currentUser.id,
        name: student?.name ?? fresh.currentUser.name,
        username: student ? student.username : fresh.currentUser.username,
        courseId: student ? student.courseId : fresh.currentUser.courseId,
        isBlocked: student?.isBlocked ?? false,
    };
    return {
        ...fresh,
        ...stored,
        currentUser,
        courses: (stored.courses ?? fresh.courses).map((course, index) => ({ ...course, order: course.order ?? index + 1 })),
        lessons: (stored.lessons ?? fresh.lessons).map(lesson => ({ ...lesson, revision: lesson.revision ?? 1 })),
        cards: (stored.cards ?? fresh.cards).map(card => ({
            ...card,
            timesShown: card.timesShown ?? card.timesCorrect + card.timesWrong,
            easeFactor: card.easeFactor ?? 2.5,
            intervalDays: card.intervalDays ?? 0,
            nextReviewAt: card.nextReviewAt ?? null,
            due: !card.nextReviewAt || Date.parse(card.nextReviewAt) <= Date.now(),
        })),
        broadcasts: (stored.broadcasts ?? fresh.broadcasts).map(item => ({ ...item, viewedBy: item.viewedBy ?? [] })),
        lessonAttempts: stored.lessonAttempts ?? {},
        lessonProgress: stored.lessonProgress ?? fresh.lessonProgress,
        cardProgress: stored.cardProgress ?? fresh.cardProgress,
    };
};

const initialRoute = (role: ProductUser['role']): AppRoute => {
    const fromHash = routeFromPath(window.location.hash);
    if (fromHash && fromHash.name !== 'welcome') return fromHash;
    if (!fromHash) return { name: 'not-found' };
    return role === 'teacher' ? { name: 'teacher' } : { name: 'welcome' };
};

export interface AppActions {
    loadLessonVocabulary(lessonId: number): Promise<LessonVocabulary>;
    generateLessonVocabulary(lessonId: number): Promise<{ items: Array<{ front: string; back: string }> }>;
    saveLessonVocabulary(lessonId: number, input: LessonVocabulary): Promise<LessonVocabulary>;
    navigate(route: AppRoute, options?: { replace?: boolean }): void;
    back(fallback?: AppRoute): void;
    resetDemo(): void;
    enroll(courseId: number): Promise<void>;
    completeLesson(result: LessonResult): void;
    recordLessonAnswer(lessonId: number, blockId: number, outcome: 'correct' | 'wrong'): void;
    answerLesson(lessonId: number, blockId: number, answer: RecordAttemptAnswerRequest['answer']): Promise<'correct' | 'wrong'>;
    finishLesson(lessonId: number): Promise<LessonResult>;
    submitHomework(lessonId: number, answer: string, file: File | null): Promise<void>;
    downloadAsset(assetId: string): Promise<Blob>;
    uploadAsset(file: File): Promise<string>;
    gradeHomework(submissionId: string, grade: number, comment: string): Promise<void>;
    reviewCard(cardId: number, correct: boolean): Promise<void>;
    sendMessage(studentId: number, body: string, from: ProductUser['role']): Promise<void>;
    toggleStudentBlocked(studentId: number): Promise<void>;
    saveLesson(lessonId: number, title: string, blocks: LessonBlock[]): Promise<void>;
    createLesson(courseId: number): Promise<number>;
    deleteLesson(lessonId: number): Promise<void>;
    createCourse(title: string, description: string, level: string): Promise<number>;
    updateCourse(courseId: number, title: string, description: string, level: string): Promise<void>;
    deleteCourse(courseId: number): Promise<void>;
    createBroadcast(caption: string, image: File, scheduledAt: string): Promise<void>;
    deleteBroadcast(broadcastId: string): Promise<void>;
    markBroadcastViewed(broadcastId: string): Promise<void>;
    markConversationRead(studentId: number, reader: ProductUser['role']): Promise<void>;
}

export interface AppContextValue extends AppActions {
    state: ProductState;
    route: AppRoute;
    demo: boolean;
}

export const AppContext = createContext<AppContextValue | null>(null);

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
    const role = useMemo(requestedRole, []);
    const repository = useMemo(createDemoProductRepository, []);
    const [state, setState] = useState<ProductState>(() => hydrateState(repository.load() ?? createDemoState(role), role));
    const [route, setRoute] = useState<AppRoute>(() => initialRoute(role));

    useEffect(() => {
        repository.save(state);
    }, [repository, state]);

    useEffect(() => {
        return repository.subscribe(next => setState(hydrateState(next, role)));
    }, [repository, role]);

    useEffect(() => {
        const onPopState = () => setRoute(routeFromPath(window.location.hash) ?? { name: 'not-found' });
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [role]);

    const navigate = useCallback((next: AppRoute, options?: { replace?: boolean }) => {
        const path = `#${routePath(next)}`;
        if (options?.replace) window.history.replaceState({ route: next }, '', path);
        else window.history.pushState({ route: next }, '', path);
        setRoute(next);
    }, []);

    const back = useCallback((fallback?: AppRoute) => {
        if (window.history.length > 1) window.history.back();
        else navigate(fallback ?? (role === 'teacher' ? { name: 'teacher' } : { name: 'home' }), { replace: true });
    }, [navigate, role]);

    const resetDemo = useCallback(() => {
        const fresh = hydrateState(createDemoState(role), role);
        setState(fresh);
        repository.clear();
        navigate(role === 'teacher' ? { name: 'teacher' } : { name: 'welcome' }, { replace: true });
    }, [navigate, repository, role]);

    const enroll = useCallback(async (courseId: number) => {
        setState(current => ({
            ...current,
            currentUser: { ...current.currentUser, courseId },
            students: current.students.map(student => student.id === current.currentUser.id ? { ...student, courseId } : student),
        }));
    }, []);

    const completeLesson = useCallback((result: LessonResult) => {
        setState(current => {
            const userProgress = current.lessonProgress[current.currentUser.id] ?? {};
            const wasAlreadyCompleted = userProgress[result.lessonId]?.status === 'completed';
            const baseLesson = current.lessons.find(item => item.id === result.lessonId);
            const lesson = baseLesson ? { ...baseLesson, ...userProgress[result.lessonId] } : undefined;
            const now = new Date().toISOString();
            const nextOrder = lesson ? lesson.order + 1 : -1;
            const nextLesson = lesson ? current.lessons.find(item => item.courseId === lesson.courseId && item.order === nextOrder) : undefined;
            const nextProgress = nextLesson ? (userProgress[nextLesson.id] ?? { status: nextLesson.status, unlocksAt: nextLesson.unlocksAt, completedAt: nextLesson.completedAt, score: nextLesson.score }) : null;
            return {
                ...current,
                results: [...current.results.filter(item => !(item.studentId === current.currentUser.id && item.lessonId === result.lessonId)), { ...result, studentId: current.currentUser.id }],
                lessonProgress: { ...current.lessonProgress, [current.currentUser.id]: {
                    ...userProgress,
                    [result.lessonId]: { status: 'completed', unlocksAt: null, completedAt: now, score: result.score },
                    ...(nextLesson && nextProgress?.status === 'locked' ? { [nextLesson.id]: { ...nextProgress, unlocksAt: new Date(Date.now() + 86400000).toISOString() } } : {}),
                } },
                students: current.students.map(student => student.id === current.currentUser.id ? {
                    ...student,
                    completedLessons: wasAlreadyCompleted ? student.completedLessons : student.completedLessons + 1,
                } : student),
                lessonAttempts: {
                    ...current.lessonAttempts,
                    [current.currentUser.id]: Object.fromEntries(Object.entries(current.lessonAttempts[current.currentUser.id] ?? {}).filter(([id]) => Number(id) !== result.lessonId)),
                },
            };
        });
    }, []);

    const recordLessonAnswer = useCallback((lessonId: number, blockId: number, outcome: 'correct' | 'wrong') => {
        setState(current => {
            const userAttempts = current.lessonAttempts[current.currentUser.id] ?? {};
            const attempt = userAttempts[lessonId] ?? {};
            if (attempt[blockId]) return current;
            return { ...current, lessonAttempts: { ...current.lessonAttempts, [current.currentUser.id]: { ...userAttempts, [lessonId]: { ...attempt, [blockId]: outcome } } } };
        });
    }, []);

    const answerLesson = useCallback(async (lessonId: number, blockId: number, value: RecordAttemptAnswerRequest['answer']) => {
        const lesson = state.lessons.find(item => item.id === lessonId);
        const block = lesson?.blocks.find(item => item.id === blockId);
        let correct = false;
        if (block?.type === 'quiz') correct = typeof value === 'string' && value.trim() === block.correctOption.trim();
        else if (block?.type === 'fill_blank') correct = typeof value === 'string' && value.trim() === block.correctAnswer.trim();
        else if (block?.type === 'true_false') correct = value === block.correct;
        else if (block?.type === 'word_order') correct = Array.isArray(value) && value.every(item => typeof item === 'string') && value.join('\u0000') === block.correctOrder.join('\u0000');
        else if (block?.type === 'match_pairs') correct = Array.isArray(value) && value.length === block.pairs.length
            && block.pairs.every(pair => value.some(item => typeof item === 'object' && item !== null && 'left' in item && 'right' in item && item.left === pair.left && item.right === pair.right));
        const outcome = correct ? 'correct' : 'wrong';
        recordLessonAnswer(lessonId, blockId, outcome);
        return outcome;
    }, [recordLessonAnswer, state.lessons]);

    const finishLesson = useCallback(async (lessonId: number) => {
        const lesson = state.lessons.find(item => item.id === lessonId);
        const scored = lesson?.blocks.filter(block => ['quiz', 'fill_blank', 'true_false', 'word_order', 'match_pairs'].includes(block.type)) ?? [];
        const answers = state.lessonAttempts[state.currentUser.id]?.[lessonId] ?? {};
        const correct = scored.filter(block => answers[block.id] === 'correct').length;
        const wrong = scored.filter(block => answers[block.id] === 'wrong').length;
        const result: LessonResult = { studentId: state.currentUser.id, lessonId, total: scored.length, correct, wrong,
            skipped: scored.length - correct - wrong, score: scored.length ? Math.round(correct / scored.length * 10) : 10 };
        completeLesson(result);
        return result;
    }, [completeLesson, state.currentUser.id, state.lessonAttempts, state.lessons]);

    const submitHomework = useCallback(async (lessonId: number, answer: string, file: File | null) => {
        const assetId = file ? await saveDemoAttachment(file) : undefined;
        setState(current => {
            const lesson = current.lessons.find(item => item.id === lessonId);
            const block = lesson?.blocks.find(item => item.type === 'homework');
            const previous = current.homework.find(item => item.studentId === current.currentUser.id && item.lessonId === lessonId);
            const submission: ProductHomework = {
                id: previous?.id ?? newId('hw'),
                studentId: current.currentUser.id,
                lessonId,
                promptHtml: block?.type === 'homework' ? block.promptHtml : previous?.promptHtml ?? '',
                answer: toPlainText(answer).trim(),
                fileName: file?.name ?? previous?.fileName ?? null,
                assetId: assetId ?? previous?.assetId,
                status: 'pending',
                grade: null,
                comment: null,
                submittedAt: new Date().toISOString(),
                gradedAt: null,
            };
            return { ...current, homework: [...current.homework.filter(item => item.id !== submission.id), submission] };
        });
    }, []);

    const gradeHomework = useCallback(async (submissionId: string, grade: number, comment: string) => {
        setState(current => ({
            ...current,
            homework: current.homework.map(item => item.id === submissionId
                ? { ...item, status: 'graded', grade, comment: comment.trim(), gradedAt: new Date().toISOString() }
                : item),
        }));
    }, []);

    const reviewCard = useCallback(async (cardId: number, correct: boolean) => {
        setState(current => {
            const userProgress = current.cardProgress[current.currentUser.id] ?? {};
            const base = current.cards.find(card => card.id === cardId);
            if (!base) return current;
            const next = reviewSrsCard({ ...base, ...userProgress[cardId] }, correct);
            const { state: cardState, due, timesShown, timesCorrect, timesWrong, easeFactor, intervalDays, nextReviewAt } = next;
            return { ...current, cardProgress: { ...current.cardProgress, [current.currentUser.id]: { ...userProgress, [cardId]: { state: cardState, due, timesShown, timesCorrect, timesWrong, easeFactor, intervalDays, nextReviewAt } } } };
        });
    }, []);

    const sendMessage = useCallback(async (studentId: number, body: string, from: ProductUser['role']) => {
        const clean = toPlainText(body).trim();
        if (!clean) return;
        setState(current => ({
            ...current,
            messages: [...current.messages, { id: newId('msg'), studentId, from, body: clean, createdAt: new Date().toISOString(), read: false }],
        }));
    }, []);

    const toggleStudentBlocked = useCallback(async (studentId: number) => {
        setState(current => ({
            ...current,
            students: current.students.map(student => student.id === studentId ? { ...student, isBlocked: !student.isBlocked } : student),
        }));
    }, []);

    const saveLesson = useCallback(async (lessonId: number, title: string, blocks: LessonBlock[]) => {
        setState(current => ({
            ...current,
            lessons: current.lessons.map(lesson => lesson.id === lessonId ? { ...lesson, title: title.trim(), revision: lesson.revision + 1, blocks: blocks.map((block, order) => ({ ...block, order })) } : lesson),
        }));
    }, []);

    const createLesson = useCallback(async (courseId: number) => {
        const id = Date.now();
        setState(current => {
            const siblings = current.lessons.filter(lesson => lesson.courseId === courseId);
            return { ...current, lessons: [...current.lessons, {
                id, courseId, order: siblings.length + 1, title: 'Новий урок', subtitle: 'Чернетка', durationMinutes: 15,
                status: siblings.length ? 'locked' : 'available', unlocksAt: null, completedAt: null, score: null, revision: 1,
                blocks: [{ id: id + 1, order: 0, type: 'text', html: '<p>Почни наповнення уроку тут.</p>' }],
            }] };
        });
        return id;
    }, []);

    const deleteLesson = useCallback(async (lessonId: number) => {
        setState(current => ({
            ...current,
            lessons: current.lessons.filter(lesson => lesson.id !== lessonId).map(lesson => lesson.courseId === current.lessons.find(item => item.id === lessonId)?.courseId
                ? { ...lesson, order: current.lessons.filter(item => item.courseId === lesson.courseId && item.id !== lessonId).sort((a, b) => a.order - b.order).findIndex(item => item.id === lesson.id) + 1 }
                : lesson),
        }));
    }, []);

    const createCourse = useCallback(async (title: string, description: string, level: string) => {
        const id = Date.now();
        setState(current => ({ ...current, courses: [...current.courses, { id, title: title.trim(), description: description.trim(), level: level.trim(), order: current.courses.length + 1 }] }));
        return id;
    }, []);

    const updateCourse = useCallback(async (courseId: number, title: string, description: string, level: string) => {
        setState(current => ({ ...current, courses: current.courses.map(course => course.id === courseId ? { ...course, title: title.trim(), description: description.trim(), level: level.trim() } : course) }));
    }, []);

    const deleteCourse = useCallback(async (courseId: number) => {
        setState(current => ({ ...current, courses: current.courses.filter(course => course.id !== courseId) }));
    }, []);

    const createBroadcast = useCallback(async (caption: string, image: File, scheduledAt: string) => {
        const broadcast: ProductBroadcast = {
            id: newId('photo'), caption: caption.trim(), imageName: image.name, scheduledAt,
            status: new Date(scheduledAt).getTime() > Date.now() ? 'scheduled' : 'sent',
            viewedBy: [],
        };
        setState(current => ({ ...current, broadcasts: [broadcast, ...current.broadcasts] }));
    }, []);

    const deleteBroadcast = useCallback(async (broadcastId: string) => {
        setState(current => ({ ...current, broadcasts: current.broadcasts.filter(item => item.id !== broadcastId) }));
    }, []);

    const markBroadcastViewed = useCallback(async (broadcastId: string) => {
        setState(current => ({ ...current, broadcasts: current.broadcasts.map(item => item.id === broadcastId && !item.viewedBy.includes(current.currentUser.id) ? { ...item, viewedBy: [...item.viewedBy, current.currentUser.id] } : item) }));
    }, []);

    const markConversationRead = useCallback(async (studentId: number, reader: ProductUser['role']) => {
        setState(current => ({ ...current, messages: current.messages.map(item => item.studentId === studentId && item.from !== reader ? { ...item, read: true } : item) }));
    }, []);

    const visibleState = useMemo<ProductState>(() => {
        if (role === 'teacher') return state;
        const lessonProgress = state.lessonProgress[state.currentUser.id] ?? {};
        const cardProgress = state.cardProgress[state.currentUser.id] ?? {};
        return {
            ...state,
            lessons: state.lessons.map(lesson => ({ ...lesson, ...lessonProgress[lesson.id] })),
            cards: state.cards.map(card => ({ ...card, ...cardProgress[card.id] })),
        };
    }, [role, state]);

    const value = useMemo<AppContextValue>(() => ({
        state: visibleState, route, demo: true, navigate, back, resetDemo, enroll, completeLesson, recordLessonAnswer, answerLesson, finishLesson,
        submitHomework, downloadAsset: readDemoAttachment, uploadAsset: saveDemoAttachment, gradeHomework, reviewCard, sendMessage, toggleStudentBlocked, saveLesson, createLesson, deleteLesson,
        createCourse, updateCourse, deleteCourse, createBroadcast, deleteBroadcast, markBroadcastViewed, markConversationRead,
        loadLessonVocabulary: async lessonId => ({ revision: 0, items: visibleState.cards.filter(card => card.lessonId === lessonId).map(({ id, front, back }) => ({ id, front, back })) }),
        generateLessonVocabulary: async () => { throw new Error('AI-генератор доступний у робочому застосунку, не в деморежимі.'); },
        saveLessonVocabulary: async (lessonId, input) => {
            setState(current => ({ ...current, cards: [...current.cards.filter(card => card.lessonId !== lessonId), ...input.items.map(item => ({
                example: '', state: 'new' as const, due: true, timesShown: 0, timesCorrect: 0, timesWrong: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: null,
                ...current.cards.find(card => card.id === item.id), ...item, lessonId,
            }))] }));
            return { ...input, revision: input.revision + 1 };
        },
    }), [answerLesson, back, completeLesson, createBroadcast, createCourse, createLesson, deleteBroadcast, deleteCourse, deleteLesson, enroll, finishLesson, gradeHomework, markBroadcastViewed, markConversationRead, navigate, recordLessonAnswer, resetDemo, reviewCard, route, saveLesson, sendMessage, submitHomework, toggleStudentBlocked, updateCourse, visibleState]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppState = () => {
    const value = useContext(AppContext);
    if (!value) throw new Error('useAppState must be used inside AppStateProvider');
    return value;
};
