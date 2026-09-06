import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZodError } from 'zod';
import { ApiError, createApiClient } from './client.js';
import { createProductApi } from './productApi.js';

const timestamp = '2026-09-06T12:00:00.000Z';
const course = { courseId: 2, title: 'Course', description: '', order: 0, lessonCount: 3 };
const lesson = { lessonId: 9, title: 'Lesson', contentRevision: 'legacy-9', blocks: [
    { id: 1, order: 0, type: 'text', html: '<p>Hello</p>' },
    { id: 2, order: 1, type: 'unsupported', reason: 'Unknown legacy content' },
] };
const submission = {
    submissionId: '12', userId: 7, lessonId: 9, answerHtml: '<p>Answer</p>',
    status: 'graded', grade: 0, teacherComment: '', createdAt: timestamp,
    gradedAt: timestamp, assets: [],
};
const student = { studentId: 7, name: 'Student', username: null, enrolledCourseId: null, isBlocked: true };
const card = {
    flashcardId: 4, lessonId: 9, lessonTitle: 'Lesson', front: 'hello', back: 'привіт',
    examplePhrase: null, timesShown: 0, timesCorrect: 0, timesWrong: 0,
    easeFactor: 2.5, intervalDays: 0, nextReviewAt: null,
};

function setup(payload: unknown, status = 200) {
    const calls: { url: string; options: RequestInit }[] = [];
    const client = createApiClient({
        getInitData: () => 'signed-init-data',
        fetcher: async (url, options) => {
            calls.push({ url: String(url), options: options ?? {} });
            return Response.json(payload, { status });
        },
    });
    return { api: createProductApi(client, () => Date.parse(timestamp)), calls };
}

test('current user identity and capabilities come only from validated /me', async () => {
    const { api, calls } = setup({ userId: 7, name: 'Student', username: null, role: 'student',
        isBlocked: true, capabilities: ['student:learn'], enrollment: { courseId: null } });
    const signal = new AbortController().signal;
    assert.deepEqual(await api.loadCurrentUser(signal), {
        id: 7, name: 'Student', username: null, role: 'student', isBlocked: true,
        capabilities: ['student:learn'], courseId: null, streakDays: null,
    });
    assert.equal(calls[0].url, '/api/v2/me');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[0].options.signal, signal);
    assert.equal(new Headers(calls[0].options.headers).get('X-Telegram-Init-Data'), 'signed-init-data');
    assert.equal(calls[0].options.body, undefined);
});

test('activity streak is read from the authenticated server calculation', async () => {
    const { api, calls } = setup({ streakDays: 4 });
    assert.equal(await api.loadCurrentStreak(), 4);
    assert.equal(calls[0].url, '/api/v2/me/streak');
});

test('course reads retain counts, zero progress, and unknown level', async () => {
    const expected = { id: 2, title: 'Course', description: '', order: 0, lessonCount: 3, level: null };
    const list = setup({ items: [course] });
    assert.deepEqual(await list.api.loadCourses(), [expected]);
    assert.deepEqual(await list.api.loadTeacherCourses(), [expected]);
    assert.deepEqual(list.calls.map(call => call.url), ['/api/v2/courses', '/api/v2/teacher/courses']);
    const current = setup({ course, completedLessons: 0, totalLessons: 3, nextLessonId: null });
    assert.deepEqual(await current.api.loadCurrentCourse(), {
        course: expected, completedLessons: 0, totalLessons: 3, nextLessonId: null,
    });
    assert.equal(current.calls[0].url, '/api/v2/me/course');
});

test('path preserves server access, homework grade and nullable server score', async () => {
    const items = ['locked', 'available', 'completed'].map((status, index) => ({
        lessonId: index + 1, title: status, order: index, status,
        unlocksAt: status === 'locked' ? timestamp : null,
        completedAt: status === 'completed' ? timestamp : null,
        score: status === 'completed' ? 8 : null,
        homework: { status: 'graded', hasHomework: true, grade: 0 },
    }));
    const { api, calls } = setup({ courseId: 2, items });
    assert.deepEqual(await api.loadCurrentCoursePath(), { courseId: 2, items: items.map(({ lessonId, ...item }) => ({
        ...item, id: lessonId, courseId: 2,
    })) });
    assert.equal(calls[0].url, '/api/v2/me/course/path');
});

test('lesson readers preserve opaque revisions and unsupported blocks', async () => {
    const { api, calls } = setup(lesson);
    const expected = { id: 9, title: 'Lesson', contentRevision: 'legacy-9', blocks: lesson.blocks };
    assert.deepEqual(await api.loadLesson(9), expected);
    assert.deepEqual(await api.loadTeacherLesson(9), expected);
    assert.deepEqual(calls.map(call => call.url), ['/api/v2/lessons/9', '/api/v2/teacher/lessons/9']);
});

test('homework list and detail retain HTML, zero grades, null prompt and all assets', async () => {
    const asset = { assetId: 'asset-1', storageKey: 'key', mimeType: 'image/png', bytes: 1, sha256: 'a'.repeat(64) };
    const { api, calls } = setup({ items: [submission, { ...submission, assets: [asset] },
        { ...submission, assets: [asset, { ...asset, assetId: 'asset-2' }] }] });
    const items = await api.loadCurrentHomework();
    assert.deepEqual(items[0], {
        id: '12', studentId: 7, lessonId: 9, promptHtml: null, answer: '<p>Answer</p>',
        fileName: null, status: 'graded', grade: 0, comment: '', submittedAt: timestamp,
        gradedAt: timestamp, assets: [],
    });
    assert.equal(items[1].assetId, 'asset-1');
    assert.equal(items[2].assetId, undefined);
    assert.equal(items[2].assets.length, 2);
    assert.deepEqual(await api.loadTeacherHomework('graded'), items);
    await api.loadTeacherHomework();
    assert.deepEqual(calls.map(call => call.url), [
        '/api/v2/me/homework', '/api/v2/teacher/homework?status=graded', '/api/v2/teacher/homework',
    ]);
    const detail = setup(submission);
    assert.deepEqual(await detail.api.loadTeacherHomeworkSubmission('12'), items[0]);
    assert.equal(detail.calls[0].url, '/api/v2/teacher/homework/12');
});

test('lesson homework retains the prompt and absence of a submission without creating a draft', async () => {
    for (const value of [null, submission]) {
        const { api, calls } = setup({ lessonId: 9, promptHtml: '<p>Task</p>', submission: value });
        const result = await api.loadLessonHomework(9);
        assert.equal(result.promptHtml, '<p>Task</p>');
        if (value === null) assert.equal(result.submission, null);
        else assert.equal(result.submission?.promptHtml, result.promptHtml);
        assert.equal(calls[0].url, '/api/v2/lessons/9/homework');
    }
});

test('cards map real counters, nullable examples, due boundary and review reset', async () => {
    const items = [card,
        { ...card, timesShown: 1, timesCorrect: 1, intervalDays: 1, nextReviewAt: timestamp },
        { ...card, timesShown: 3, timesCorrect: 3, intervalDays: 7, nextReviewAt: '2026-09-07T12:00:00Z' },
        { ...card, timesShown: 4, timesCorrect: 3, timesWrong: 1, intervalDays: 0 },
    ];
    const { api, calls } = setup({ items });
    const cards = await api.loadCards();
    assert.deepEqual(cards[0], {
        id: 4, lessonId: 9, lessonTitle: 'Lesson', front: 'hello', back: 'привіт', example: null,
        state: 'new', due: true, timesShown: 0, timesCorrect: 0, timesWrong: 0,
        easeFactor: 2.5, intervalDays: 0, nextReviewAt: null,
    });
    assert.deepEqual(cards.map(item => [item.state, item.due]), [
        ['new', true], ['learning', true], ['learned', false], ['learning', true],
    ]);
    assert.deepEqual(await api.loadStudyCards(4), cards);
    await api.loadStudyCards();
    assert.deepEqual(calls.map(call => call.url), [
        '/api/v2/me/dictionary', '/api/v2/me/study-session?limit=4', '/api/v2/me/study-session?limit=20',
    ]);
});

test('teacher lesson summaries do not invent blocks or student progress', async () => {
    const { api, calls } = setup({ courseId: 2, items: [{ lessonId: 9, title: 'Lesson', order: 0, blockCount: 2, hasHomework: false }] });
    assert.deepEqual(await api.loadTeacherLessons(2), { courseId: 2, items: [
        { id: 9, courseId: 2, title: 'Lesson', order: 0, blockCount: 2, hasHomework: false },
    ] });
    assert.equal(calls[0].url, '/api/v2/teacher/courses/2/lessons');
});

test('teacher students distinguish summaries, real zero counts and unknown last activity', async () => {
    const summary = { id: 7, name: 'Student', username: null, courseId: null, isBlocked: true };
    const list = setup({ items: [student] });
    assert.deepEqual(await list.api.loadTeacherStudents(), [summary]);
    assert.equal(list.calls[0].url, '/api/v2/teacher/students');
    const details = setup({ item: { ...student, completedLessons: 0, totalLessons: 0, averageScore: null, pendingHomework: 0 } });
    assert.deepEqual(await details.api.loadTeacherStudent(7), {
        ...summary, completedLessons: 0, totalLessons: 0, averageScore: null, pendingHomework: 0, lastActive: null,
    });
    assert.equal(details.calls[0].url, '/api/v2/teacher/students/7');
    const item = { studentCount: 1, blockedStudentCount: 1, courseCount: 2, lessonCount: 3, pendingHomeworkCount: 0, completedLessonCount: 0 };
    const stats = setup({ item });
    assert.deepEqual(await stats.api.loadTeacherStatistics(), item);
    assert.equal(stats.calls[0].url, '/api/v2/teacher/statistics');
});

test('empty lists remain empty', async () => {
    const { api } = setup({ items: [] });
    for (const load of [api.loadCourses, api.loadCards, api.loadCurrentHomework, api.loadTeacherCourses, api.loadTeacherStudents]) {
        assert.deepEqual(await load(), []);
    }
});

test('structured authentication/access/not-found/server errors are propagated intact', async () => {
    for (const [status, code] of [[401, 'UNAUTHENTICATED'], [401, 'AUTH_EXPIRED'], [403, 'FORBIDDEN'],
        [403, 'BLOCKED'], [404, 'NOT_FOUND'], [429, 'RATE_LIMITED'], [503, 'INTERNAL']] as const) {
        const body = { code, message: 'Server message', requestId: 'request-1', retryAfter: 30 };
        const { api } = setup(body, status);
        await assert.rejects(api.loadCurrentCourse(), error => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.status, status);
            assert.deepEqual(error.body, body);
            return true;
        });
    }
});

test('invalid successful payloads and malformed error bodies never become fallback data', async () => {
    for (const payload of [{}, { ...lesson, contentRevision: 9 }, { ...lesson, blocks: [{ type: 'unknown' }] }]) {
        await assert.rejects(setup(payload).api.loadLesson(9), error =>
            error instanceof ApiError && error.message === 'API returned an invalid response');
    }
    await assert.rejects(setup({ error: 'oops' }, 500).api.loadCards(), error =>
        error instanceof ApiError && error.status === 500 && error.body === null);
});

test('bad route parameters are rejected before fetch', async () => {
    const { api, calls } = setup({});
    for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        for (const load of [api.loadLesson, api.loadLessonHomework, api.loadTeacherLesson, api.loadTeacherLessons, api.loadTeacherStudent]) {
            await assert.rejects(load(id), ZodError);
        }
    }
    for (const limit of [0, 21, 1.5]) await assert.rejects(api.loadStudyCards(limit), ZodError);
    for (const id of ['', '../me', 'draft-id', '0', '9007199254740992']) {
        await assert.rejects(api.loadTeacherHomeworkSubmission(id), ZodError);
    }
    assert.equal(calls.length, 0);
});

test('network and abort failures remain observable', async () => {
    for (const error of [new TypeError('offline'), new DOMException('Aborted', 'AbortError')]) {
        const api = createProductApi(createApiClient({ getInitData: () => 'signed', fetcher: async () => { throw error; } }));
        await assert.rejects(api.loadCurrentUser(), value => value === error);
    }
});
