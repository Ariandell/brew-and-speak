import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LessonBlock, RecordAttemptAnswerRequest } from '../api/contracts';
import { ApiError } from '../api/client';
import { createProductApi } from '../api/productApi';
import { AppContext, type AppContextValue } from './AppState';
import type { AppRoute } from './routes';
import { routeFromPath, routePath } from './routes';
import type { LessonResult, ProductLesson, ProductState, ProductStudent } from './productTypes';
import { toPlainText } from '../lib/plainText';
import { clearProductionLessonSession, readProductionAttemptSession,
    writeProductionAttemptSession } from './productionAttemptSession';

const emptyState = (user: ProductState['currentUser']): ProductState => ({
    currentUser: user, courses: [], lessons: [], results: [], homework: [], cards: [], messages: [], students: [], broadcasts: [],
    lessonAttempts: {}, lessonProgress: {}, cardProgress: {},
});

const routeAtStartup = (): AppRoute => routeFromPath(window.location.hash) ?? { name: 'welcome' };
const uuid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const lessonShell = (item: { id: number; courseId: number; title: string; order: number; status: ProductLesson['status']; unlocksAt: string | null; completedAt: string | null; score?: number | null }, blocks: LessonBlock[] = []): ProductLesson => ({
    ...item, subtitle: '', durationMinutes: 15, score: item.score ?? null, revision: 0, blocks,
});

export const ProductionAppStateProvider = ({ children }: { children: ReactNode }) => {
    const api = useMemo(() => createProductApi(), []);
    const [state, setState] = useState<ProductState | null>(null);
    const [route, setRoute] = useState<AppRoute>(routeAtStartup);
    const [fatal, setFatal] = useState<Error | null>(null);
    const attempts = useRef(new Map<number, string>());

    const load = useCallback(async (signal?: AbortSignal) => {
        const user = await api.loadCurrentUser(signal);
        const streakDays = user.role === 'student' && !user.isBlocked ? await api.loadCurrentStreak(signal) : 0;
        const currentUser = { ...user, streakDays };
        const storedAttempts = readProductionAttemptSession(user.id);
        attempts.current = new Map(Object.entries(storedAttempts.attempts).map(([lessonId, attemptId]) => [Number(lessonId), attemptId]));
        if (user.role === 'student' && user.isBlocked) {
            const blockedState = emptyState(currentUser);
            blockedState.lessonAttempts[user.id] = storedAttempts.outcomes;
            setState(blockedState);
            return blockedState;
        }
        const courses = (user.role === 'teacher' ? await api.loadTeacherCourses(signal) : await api.loadCourses(signal))
            .map(course => ({ ...course, level: course.level ?? '' }));
        const base = emptyState(currentUser);
        base.lessonAttempts[user.id] = storedAttempts.outcomes;
        base.courses = courses;

        if (user.role === 'student') {
            let path: Awaited<ReturnType<typeof api.loadCurrentCoursePath>> | null = null;
            if (user.courseId !== null) {
                try { path = await api.loadCurrentCoursePath(signal); }
                catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error; }
            }
            const pathItems = path?.items ?? [];
            const content = await Promise.all(pathItems.map(item => item.status === 'locked'
                ? Promise.resolve(null)
                : api.loadLesson(item.id, signal)));
            base.lessons = pathItems.map((item, index) => lessonShell(item, content[index]?.blocks ?? []));
            const [homework, cards, chat, photos] = await Promise.all([
                user.courseId === null ? Promise.resolve([]) : api.loadCurrentHomework(signal),
                user.courseId === null ? Promise.resolve([]) : api.loadCards(signal),
                api.loadCurrentChat(signal), api.loadPhotoMessages(signal),
            ]);
            base.homework = homework.map(item => ({ ...item, promptHtml: item.promptHtml ?? '' }));
            base.cards = cards.map(item => ({ ...item, example: item.example ?? '' }));
            base.messages = chat.items.map(message => ({
                id: message.messageId, studentId: user.id, from: message.senderUserId === user.id ? 'student' : 'teacher',
                body: message.body, createdAt: message.createdAt, read: message.readAt !== null,
            }));
            base.broadcasts = photos.items.map(photo => ({
                id: photo.photoId, assetId: photo.assetId, imageName: photo.assetId, caption: photo.caption,
                scheduledAt: photo.scheduledAt, status: 'sent', viewedBy: photo.viewedAt ? [user.id] : [],
            }));
            base.students = [{ id: user.id, name: user.name, username: user.username, courseId: user.courseId,
                isBlocked: user.isBlocked, completedLessons: pathItems.filter(item => item.status === 'completed').length,
                totalLessons: pathItems.length, averageScore: null, lastActive: '' }];
        } else {
            const [studentSummaries, homework] = await Promise.all([
                api.loadTeacherStudents(signal), api.loadTeacherHomework(undefined, signal),
            ]);
            const [students, lessonGroups, conversations, photos] = await Promise.all([
                Promise.all(studentSummaries.map(async student => {
                    const detail = await api.loadTeacherStudent(student.id, signal);
                    return { ...detail, lastActive: detail.lastActive ?? '' } as ProductStudent;
                })),
                Promise.all(courses.map(course => api.loadTeacherLessons(course.id, signal))),
                api.loadTeacherConversations(signal),
                api.loadTeacherPhotoMessages(signal),
            ]);
            const lessonSummaries = lessonGroups.flatMap(group => group.items);
            const lessonContent = await Promise.all(lessonSummaries.map(item => api.loadTeacherLesson(item.id, signal)));
            base.students = students;
            base.lessons = lessonSummaries.map((item, index) => lessonShell({ ...item, status: 'available', unlocksAt: null, completedAt: null }, lessonContent[index]?.blocks ?? []));
            base.lessons.forEach((lesson, index) => { lesson.revision = Number(lessonContent[index]?.contentRevision.replace(/^draft-/, '')) || 0; });
            base.homework = homework.map(item => ({ ...item, promptHtml: item.promptHtml ?? '' }));
            const chats = await Promise.all(conversations.items.map(item => api.loadTeacherChat(item.studentUserId, signal)));
            base.messages = chats.flatMap((chat, index) => chat.items.map(message => ({
                id: message.messageId, studentId: conversations.items[index].studentUserId,
                from: message.senderUserId === user.id ? 'teacher' as const : 'student' as const,
                body: message.body, createdAt: message.createdAt, read: message.readAt !== null,
            })));
            base.broadcasts = photos.items.map(photo => ({ id: photo.photoId, assetId: photo.assetId, imageName: photo.assetId,
                caption: photo.caption, scheduledAt: photo.scheduledAt, status: Date.parse(photo.scheduledAt) <= Date.now() ? 'sent' : 'scheduled', viewedBy: [] }));
        }
        setState(previous => previous ? { ...base, results: previous.results, lessonAttempts: previous.lessonAttempts } : base);
        return base;
    }, [api]);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal).catch(error => { if (!controller.signal.aborted) setFatal(error instanceof Error ? error : new Error('Не вдалося завантажити застосунок')); });
        return () => controller.abort();
    }, [load]);

    useEffect(() => {
        const pop = () => setRoute(routeFromPath(window.location.hash) ?? { name: 'not-found' });
        window.addEventListener('popstate', pop);
        return () => window.removeEventListener('popstate', pop);
    }, []);

    const downloadAsset = useCallback((assetId: string) => api.downloadHomeworkAsset(assetId), [api]);

    const navigate = (next: AppRoute, options?: { replace?: boolean }) => {
        const path = `#${routePath(next)}`;
        if (options?.replace) window.history.replaceState({ route: next }, '', path);
        else window.history.pushState({ route: next }, '', path);
        setRoute(next);
    };
    const back = (fallback?: AppRoute) => window.history.length > 1 ? window.history.back() : navigate(fallback ?? { name: 'home' }, { replace: true });

    if (fatal) return <main className="flex min-h-[100dvh] items-center justify-center bg-base p-6 text-text"><div className="max-w-sm rounded-[24px] bg-surface p-6 shadow-panel"><h1 className="text-2xl font-black">Не вдалося відкрити застосунок.</h1><p className="mt-3 text-sm font-semibold text-text-soft">{fatal.message}</p><button className="mt-5 rounded-pill bg-accent px-5 py-3 font-black text-white" onClick={() => window.location.reload()}>Спробувати ще раз</button></div></main>;
    if (!state) return <main className="flex min-h-[100dvh] items-center justify-center bg-base text-sm font-black text-accent">Завантажуємо English with Coffee…</main>;

    const refresh = () => load().then(() => undefined);
    const ensureAttempt = async (lessonId: number) => {
        const existing = attempts.current.get(lessonId);
        if (existing) return existing;
        const attemptId = uuid('attempt');
        await api.startAttempt({ attemptId, lessonId });
        attempts.current.set(lessonId, attemptId);
        const stored = readProductionAttemptSession(state.currentUser.id);
        stored.attempts[lessonId] = attemptId;
        writeProductionAttemptSession(state.currentUser.id, stored);
        return attemptId;
    };
    const value: AppContextValue = {
        state, route, demo: false, navigate, back, resetDemo: () => undefined,
        enroll: async courseId => {
            const enrollment = await api.enroll({ courseId });
            await refresh();
            // Keep the mutation response authoritative for the immediate render.
            // This also prevents an older in-flight read from briefly restoring
            // the pre-enrollment user while navigation enters the home screen.
            setState(current => current && ({
                ...current,
                currentUser: { ...current.currentUser, courseId: enrollment.courseId },
            }));
        },
        completeLesson: () => { throw new Error('Production uses finishLesson'); },
        recordLessonAnswer: () => { throw new Error('Production uses answerLesson'); },
        answerLesson: async (lessonId: number, blockId: number, answer: RecordAttemptAnswerRequest['answer']) => {
            const attemptId = await ensureAttempt(lessonId);
            const result = await api.answerAttempt(attemptId, { blockId: String(blockId), answer });
            setState(current => current && ({ ...current, lessonAttempts: { ...current.lessonAttempts,
                [current.currentUser.id]: { ...(current.lessonAttempts[current.currentUser.id] ?? {}),
                    [lessonId]: { ...(current.lessonAttempts[current.currentUser.id]?.[lessonId] ?? {}), [blockId]: result.outcome } } } }));
            const stored = readProductionAttemptSession(state.currentUser.id);
            stored.outcomes[lessonId] = { ...(stored.outcomes[lessonId] ?? {}), [blockId]: result.outcome };
            writeProductionAttemptSession(state.currentUser.id, stored);
            return result.outcome;
        },
        finishLesson: async lessonId => {
            const attemptId = await ensureAttempt(lessonId);
            const result = await api.finishAttempt(attemptId);
            attempts.current.delete(lessonId);
            clearProductionLessonSession(state.currentUser.id, lessonId);
            const mapped: LessonResult = { studentId: result.userId, lessonId: result.lessonId, total: result.total,
                correct: result.correct, wrong: result.wrong, skipped: result.skipped, score: result.score ?? 0 };
            setState(current => current && ({ ...current, results: [...current.results.filter(item => item.lessonId !== lessonId), mapped] }));
            await refresh();
            return mapped;
        },
        submitHomework: async (lessonId, answer, file) => {
            const previous = state.homework.find(item => item.studentId === state.currentUser.id && item.lessonId === lessonId);
            const assets = [...(previous?.assets ?? [])];
            if (file) {
                const uploaded = await api.uploadHomeworkAsset(uuid('asset'), file);
                assets.push({ ...uploaded, storageKey: uploaded.assetId, fileName: file.name });
            }
            await api.submitHomework({ lessonId, submissionId: previous?.id.startsWith('homework-') ? previous.id : uuid('homework'), answerHtml: toPlainText(answer).trim(), assets });
            await refresh();
        },
        downloadAsset,
        uploadAsset: async file => (await api.uploadTeacherAsset(uuid('asset'), file)).assetId,
        gradeHomework: async (submissionId, grade, comment) => { await api.gradeHomework(submissionId, { grade, teacherComment: comment }); await refresh(); },
        reviewCard: async (cardId, correct) => { await api.reviewCard(cardId, { correct, idempotencyKey: uuid('review') }); await refresh(); },
        sendMessage: async (studentId, body, from) => {
            const clean = toPlainText(body).trim(); if (!clean) return;
            if (from === 'teacher') await api.sendTeacherChatMessage(studentId, { messageId: uuid('message'), body: clean });
            else await api.sendChatMessage({ messageId: uuid('message'), body: clean });
            await refresh();
        },
        toggleStudentBlocked: async studentId => {
            const student = state.students.find(item => item.id === studentId); if (!student) return;
            if (student.isBlocked) await api.unblockStudent(studentId); else await api.blockStudent(studentId);
            await refresh();
        },
        loadLessonVocabulary: api.loadLessonVocabulary,
        generateLessonVocabulary: api.generateLessonVocabulary,
        saveLessonVocabulary: api.saveLessonVocabulary,
        saveLesson: async (lessonId, title, blocks) => {
            const lesson = state.lessons.find(item => item.id === lessonId);
            if (!lesson) throw new Error('Урок не знайдено');
            const cleanTitle = title.trim();
            if (!cleanTitle) throw new Error('Назва уроку не може бути порожньою');
            if (cleanTitle !== lesson.title) await api.updateLesson(lessonId, { title: cleanTitle });
            await api.saveTeacherLessonDraft(lessonId, { expectedRevision: lesson?.revision ?? null, blocks });
            await refresh();
        },
        createLesson: async courseId => {
            const siblings = state.lessons.filter(item => item.courseId === courseId);
            const order = siblings.reduce((largest, item) => Math.max(largest, item.order), 0) + 1;
            const created = await api.createLesson(courseId, { title: 'Новий урок', order });
            await api.saveTeacherLessonDraft(created.lessonId, {
                expectedRevision: 0,
                blocks: [{ id: Date.now(), order: 0, type: 'text', html: '<p>Почни наповнення уроку тут.</p>' }],
            });
            await refresh();
            return created.lessonId;
        },
        deleteLesson: async lessonId => { await api.deleteLesson(lessonId); await refresh(); },
        createCourse: async (title, description) => {
            const course = await api.createCourse({ title, description, order: state.courses.length + 1 });
            await refresh();
            return course.courseId;
        },
        updateCourse: async (courseId, title, description) => { await api.updateCourse(courseId, { title, description }); await refresh(); },
        deleteCourse: async courseId => { await api.deleteCourse(courseId); await refresh(); },
        createBroadcast: async (caption, image, scheduledAt) => {
            const uploaded = await api.uploadTeacherAsset(uuid('asset'), image);
            await api.schedulePhoto({ photoId: uuid('photo'), assetId: uploaded.assetId, caption, scheduledAt });
            await refresh();
        },
        deleteBroadcast: async broadcastId => { await api.deletePhoto(broadcastId); await refresh(); },
        markBroadcastViewed: async broadcastId => { await api.markPhotoViewed(broadcastId); await refresh(); },
        markConversationRead: async (studentId, reader) => {
            const unread = state.messages.filter(item => item.studentId === studentId && item.from !== reader && !item.read);
            await Promise.all(unread.map(message => reader === 'teacher' ? api.markTeacherChatRead({ messageId: message.id }) : api.markChatRead({ messageId: message.id })));
            if (unread.length) await refresh();
        },
    };
    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
