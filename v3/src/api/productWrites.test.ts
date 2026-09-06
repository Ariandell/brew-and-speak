import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ZodError } from 'zod';
import { ApiError, createApiClient } from './client.js';
import { createProductApi, type ProductApi } from './productApi.js';

const time = '2026-09-06T12:00:00.000Z';
const attempt = { attemptId: 'attempt/1', userId: 7, lessonId: 9, contentRevision: 'opaque', status: 'active',
    total: 1, correct: 0, wrong: 0, skipped: 0, score: null, startedAt: time, finishedAt: null };
const course = { courseId: 2, title: 'Course', description: '', order: 0, lessonCount: 0 };
const message = { messageId: 'message-1', senderUserId: 7, recipientUserId: 8, body: 'hello', createdAt: time, readAt: null };
const schedule = { photoId: 'photo/1', assetId: 'image-1', caption: '', scheduledAt: time };
const review = { flashcardId: 4, timesShown: 1, timesCorrect: 0, timesWrong: 1, easeFactor: 2.3, intervalDays: 0, nextReviewAt: time };
const submission = { submissionId: 'submission-1', userId: 7, lessonId: 9, answerHtml: '<p>Answer</p>', status: 'pending',
    grade: null, teacherComment: null, createdAt: time, gradedAt: null, assets: [] };
const draft = { expectedRevision: null, blocks: [{ id: 1, order: 0, type: 'text' as const, html: '<p>Hello</p>' }] };
const lesson = { lessonId: 9, title: 'Lesson', contentRevision: 'draft-1', blocks: draft.blocks };

function setup(respond: (url: string, body: unknown) => Response = () => Response.json({})) {
    const calls: { path: string; method: string; body: unknown; headers: Headers; signal?: AbortSignal | null }[] = [];
    const client = createApiClient({ getInitData: () => 'signed', fetcher: async (url, options) => {
        const path = String(url).replace('/api/v2', '');
        const body = options?.body === undefined ? undefined : JSON.parse(String(options.body));
        calls.push({ path, body, method: options?.method ?? 'GET', headers: new Headers(options?.headers), signal: options?.signal });
        assert.ok(!String(url).includes('/sandbox'));
        assert.equal(new Headers(options?.headers).get('X-Telegram-Init-Data'), 'signed');
        if (body !== undefined) assert.equal(new Headers(options?.headers).get('Content-Type'), 'application/json');
        assert.ok(!('expectedStatus' in (options ?? {})));
        return respond(path, body);
    } });
    return { api: createProductApi(client), calls };
}

test('canonical writes serialize only contract data and return validated server results', async () => {
    const cases: { path: string; method: string; body?: unknown; response: unknown; run(api: ProductApi, signal: AbortSignal): Promise<unknown> }[] = [
        { path: '/me/enrollment', method: 'POST', body: { courseId: 2 }, response: { courseId: 2 }, run: (api, s) => api.enroll({ courseId: 2 }, s) },
        { path: '/attempts', method: 'POST', body: { attemptId: 'attempt/1', lessonId: 9 }, response: attempt,
            run: (api, s) => api.startAttempt({ attemptId: 'attempt/1', lessonId: 9 }, s) },
        { path: '/attempts/attempt%2F1/finish', method: 'POST', response: { ...attempt, status: 'finished', score: 0, skipped: 1, finishedAt: time },
            run: (api, s) => api.finishAttempt('attempt/1', s) },
        { path: '/me/flashcards/4/review', method: 'POST', body: { correct: false, idempotencyKey: 'review-1' }, response: review,
            run: (api, s) => api.reviewCard(4, { correct: false, idempotencyKey: 'review-1' }, s) },
        { path: '/teacher/lessons/9/blocks', method: 'PUT', body: draft, response: lesson,
            run: (api, s) => api.saveTeacherLessonDraft(9, draft, s) },
        { path: '/teacher/courses/2/lessons', method: 'POST', body: { title: 'Lesson', order: 1 }, response: lesson,
            run: (api, s) => api.createLesson(2, { title: ' Lesson ', order: 1 }, s) },
        { path: '/teacher/lessons/9', method: 'PATCH', body: { title: 'Lesson' }, response: lesson,
            run: (api, s) => api.updateLesson(9, { title: 'Lesson' }, s) },
        { path: '/teacher/students/7/block', method: 'POST', response: { studentId: 7, isBlocked: true }, run: (api, s) => api.blockStudent(7, s) },
        // Preserve effective server status: a legacy block may survive an unblock.
        { path: '/teacher/students/7/unblock', method: 'POST', response: { studentId: 7, isBlocked: true }, run: (api, s) => api.unblockStudent(7, s) },
        { path: '/teacher/courses', method: 'POST', body: { title: 'Course', description: '', order: 0 }, response: course,
            run: (api, s) => api.createCourse({ title: ' Course ', description: '', order: 0 }, s) },
        { path: '/teacher/courses/2', method: 'PATCH', body: { title: 'Course' }, response: course,
            run: (api, s) => api.updateCourse(2, { title: 'Course' }, s) },
        { path: '/lessons/9/homework', method: 'POST', body: { submissionId: 'submission-1', answerHtml: '<p>Answer</p>', assets: [] }, response: submission,
            run: (api, s) => api.submitHomework({ submissionId: 'submission-1', lessonId: 9, answerHtml: '<p>Answer</p>' }, s) },
        { path: '/teacher/homework/submission%2F1/grade', method: 'POST', body: { grade: 0, teacherComment: '' },
            response: { ...submission, status: 'graded', grade: 0, teacherComment: '', gradedAt: time },
            run: (api, s) => api.gradeHomework('submission/1', { grade: 0, teacherComment: '' }, s) },
        { path: '/me/chat/messages', method: 'POST', body: { messageId: 'message-1', body: 'hello' }, response: message,
            run: (api, s) => api.sendChatMessage({ messageId: 'message-1', body: 'hello' }, s) },
        { path: '/teacher/chat/conversations/7/messages', method: 'POST', body: { messageId: 'message-1', body: 'hello' }, response: message,
            run: (api, s) => api.sendTeacherChatMessage(7, { messageId: 'message-1', body: 'hello' }, s) },
        { path: '/teacher/photo-messages', method: 'POST', body: schedule, response: { photoId: schedule.photoId },
            run: (api, s) => api.schedulePhoto(schedule, s) },
    ];
    for (const entry of cases) {
        const { api, calls } = setup(() => Response.json(entry.response));
        const signal = new AbortController().signal;
        assert.deepEqual(await entry.run(api, signal), entry.response, entry.path);
        assert.equal(calls.length, 1);
        assert.deepEqual({ path: calls[0].path, method: calls[0].method, body: calls[0].body },
            { path: entry.path, method: entry.method, body: entry.body });
        assert.equal(calls[0].signal, signal);
    }
});

test('attempt answers send actual values including false, ordered words and pairs, never outcomes', async () => {
    const { api, calls } = setup(() => Response.json({ recorded: true, reason: 'recorded', outcome: 'correct' }));
    for (const answer of ['option', false, ['a', 'b'], [{ left: 'a', right: 'b' }]]) {
        await api.answerAttempt('attempt/1', { blockId: 'block-1', answer });
        assert.deepEqual(calls[calls.length - 1]?.body, { blockId: 'block-1', answer });
        assert.equal(calls[calls.length - 1]?.path, '/attempts/attempt%2F1/answers');
    }
    const duplicate = setup(() => Response.json({ recorded: false, reason: 'duplicate', outcome: 'wrong' }));
    assert.deepEqual(await duplicate.api.answerAttempt('attempt/1', { blockId: 'block-1', answer: false }), { recorded: false, reason: 'duplicate', outcome: 'wrong' });
    // @ts-expect-error Outcome is not an answer contract.
    await assert.rejects(api.answerAttempt('a', { blockId: 'b', outcome: 'correct' }), ZodError);
    // @ts-expect-error Client-supplied score must be rejected even with an answer.
    await assert.rejects(api.answerAttempt('a', { blockId: 'b', answer: true, score: 10 }), ZodError);
    assert.equal(calls.length, 4);
});

test('204 operations serialize their bodies and reject a 200 HTML fallback', async () => {
    const { api, calls } = setup(() => new Response(null, { status: 204 }));
    assert.equal(await api.deleteCourse(2), undefined);
    assert.equal(await api.deleteLesson(9), undefined);
    await api.markChatRead({ messageId: 'm-1' });
    await api.markTeacherChatRead({ messageId: 'm-2' });
    await api.markPhotoViewed('photo/1');
    await api.deletePhoto('photo/1');
    await api.abortAssetUpload('upload/1');
    assert.deepEqual(calls.map(({ path, method, body }) => ({ path, method, body })), [
        { path: '/teacher/courses/2', method: 'DELETE', body: undefined },
        { path: '/teacher/lessons/9', method: 'DELETE', body: undefined },
        { path: '/me/chat/read', method: 'POST', body: { messageId: 'm-1' } },
        { path: '/teacher/chat/read', method: 'POST', body: { messageId: 'm-2' } },
        { path: '/me/photo-messages/photo%2F1/viewed', method: 'POST', body: {} },
        { path: '/teacher/photo-messages/photo%2F1', method: 'DELETE', body: undefined },
        { path: '/assets/uploads/upload%2F1', method: 'DELETE', body: undefined },
    ]);
    await assert.rejects(setup(() => new Response('<html>SPA</html>')).api.deleteCourse(2), ApiError);
});

test('chat and photo reads use known route shapes without synthesizing product roles', async () => {
    const { api, calls } = setup(path => Response.json(path === '/teacher/chat/conversations'
        ? { items: [{ studentUserId: 7, lastMessage: message, unreadCount: 1 }] }
        : path === '/me/photo-messages' ? { items: [{ ...schedule, viewedAt: null }] } : { items: [message] }));
    assert.deepEqual(await api.loadCurrentChat(), { items: [message] });
    assert.deepEqual(await api.loadTeacherChat(7), { items: [message] });
    assert.equal((await api.loadTeacherConversations()).items[0].unreadCount, 1);
    assert.equal((await api.loadPhotoMessages()).items[0].viewedAt, null);
    assert.deepEqual(calls.map(call => call.path), ['/me/chat', '/teacher/chat/conversations/7', '/teacher/chat/conversations', '/me/photo-messages']);
});

test('invalid commands fail validation before any request', async () => {
    const { api, calls } = setup();
    const invalid = [
        () => api.enroll({ courseId: 0 }), () => api.startAttempt({ attemptId: '', lessonId: 9 }),
        () => api.finishAttempt('..'), () => api.answerAttempt('', { blockId: 'b', answer: true }),
        () => api.reviewCard(4, { correct: true, idempotencyKey: '' }),
        () => api.reviewCard(0, { correct: true, idempotencyKey: 'key' }),
        () => api.saveTeacherLessonDraft(9, { ...draft, expectedRevision: -1 }),
        () => api.createLesson(0, { title: 'Lesson', order: 0 }),
        () => api.createLesson(2, { title: ' ', order: 0 }),
        () => api.updateLesson(9, {}), () => api.deleteLesson(0),
        () => api.blockStudent(0), () => api.unblockStudent(1.5),
        () => api.createCourse({ title: ' ', description: '', order: 0 }), () => api.updateCourse(2, {}),
        () => api.deleteCourse(NaN), () => api.gradeHomework('s', { grade: 11, teacherComment: '' }),
        () => api.submitHomework({ lessonId: 9, submissionId: '', answerHtml: 'answer' }),
        () => api.sendChatMessage({ messageId: '', body: 'hi' }),
        () => api.sendTeacherChatMessage(0, { messageId: 'm', body: 'hi' }),
        () => api.markChatRead({ messageId: '' }), () => api.markTeacherChatRead({ messageId: '' }),
        () => api.schedulePhoto({ ...schedule, scheduledAt: 'tomorrow' }), () => api.deletePhoto(''), () => api.markPhotoViewed(''),
        () => api.downloadHomeworkAsset(''),
    ];
    for (const run of invalid) await assert.rejects(run(), ZodError);
    // @ts-expect-error Identity cannot be supplied by a caller.
    await assert.rejects(api.enroll({ courseId: 2, userId: 99 }), ZodError);
    // @ts-expect-error Lesson title is not writable through the blocks route.
    await assert.rejects(api.saveTeacherLessonDraft(9, { ...draft, title: 'new' }), ZodError);
    assert.equal(calls.length, 0);
});

test('caller idempotency IDs and revision survive explicit retries without regeneration', async () => {
    const { api, calls } = setup(path => Response.json(path === '/attempts' ? attempt
        : path.includes('/review') ? review : path.includes('/homework') ? submission
        : path.includes('/blocks') ? lesson : path.includes('/photo-messages') ? { photoId: schedule.photoId }
        : path.includes('/answers') ? { recorded: false, reason: 'duplicate', outcome: 'wrong' } : message));
    const operations = [
        () => api.startAttempt({ attemptId: 'same-attempt', lessonId: 9 }),
        () => api.answerAttempt('same-attempt', { blockId: 'same-block', answer: false }),
        () => api.reviewCard(4, { correct: false, idempotencyKey: 'same-review' }),
        () => api.submitHomework({ lessonId: 9, submissionId: 'same-submission', answerHtml: 'answer' }),
        () => api.sendChatMessage({ messageId: 'same-message', body: 'hi' }),
        () => api.schedulePhoto(schedule),
        () => api.saveTeacherLessonDraft(9, { ...draft, expectedRevision: 4 }),
    ];
    for (const run of operations) {
        await run(); await run();
        assert.deepEqual(calls[calls.length - 1]?.body, calls[calls.length - 2]?.body);
    }
    assert.equal(calls.length, operations.length * 2);
});

test('write errors retain details, never retry or fall back, and malformed successes fail', async () => {
    for (const [status, code] of [[401, 'AUTH_EXPIRED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'CONFLICT'], [409, 'COOLDOWN'], [422, 'CONTENT_INVALID']] as const) {
        const body = { code, message: 'Rejected', requestId: 'request-1', retryAfter: 20, fields: { blocks: ['invalid'] } };
        const { api, calls } = setup(() => Response.json(body, { status }));
        await assert.rejects(api.startAttempt({ attemptId: 'a', lessonId: 9 }), error => {
            assert.ok(error instanceof ApiError); assert.equal(error.status, status); assert.deepEqual(error.body, body); return true;
        });
        assert.equal(calls.length, 1);
    }
    await assert.rejects(setup().api.startAttempt({ attemptId: 'a', lessonId: 9 }), ApiError);
    await assert.rejects(setup(() => Response.json({ recorded: true, reason: 'duplicate' })).api.answerAttempt('a', { blockId: 'b', answer: true }), ApiError);
    const failure = new TypeError('offline');
    const { api, calls } = setup(() => { throw failure; });
    await assert.rejects(api.createCourse({ title: 'Course', description: '', order: 0 }), error => error === failure);
    assert.equal(calls.length, 1);
});

const file = new File([new Uint8Array([0, 127, 128, 255])], 'answer.png', { type: 'image/png' });
const metadata = { assetId: 'asset-1', mimeType: 'image/png', bytes: 4,
    sha256: createHash('sha256').update(new Uint8Array([0, 127, 128, 255])).digest('hex') };

test('homework upload uses bounded chunks, stable sessions, then submits verified references', async () => {
    const plans = new Map<string, { assetId: string; mimeType: string; totalBytes: number; sha256: string; chunkSize: number; totalChunks: number }>();
    const { api, calls } = setup((path, body) => {
        if (path === '/assets/uploads') {
            const plan = body as typeof metadata & { uploadId: string; totalBytes: number; chunkSize: number; totalChunks: number };
            plans.set(plan.uploadId, plan);
            return Response.json({ uploadId: plan.uploadId, assetId: plan.assetId, expiresAt: time, chunkSize: plan.chunkSize,
                totalChunks: plan.totalChunks, nextChunkIndex: 0, status: 'active' });
        }
        const uploadId = decodeURIComponent(path.split('/')[3] ?? '');
        const plan = plans.get(uploadId)!;
        if (path.includes('/chunks/')) return Response.json({ uploadId, assetId: plan.assetId, expiresAt: time,
            chunkSize: plan.chunkSize, totalChunks: plan.totalChunks, nextChunkIndex: 1, status: 'active' });
        if (path.endsWith('/finalize')) return Response.json({ assetId: plan.assetId, mimeType: plan.mimeType,
            bytes: plan.totalBytes, sha256: plan.sha256 });
        return Response.json({ ...submission, submissionId: (body as { submissionId?: string })?.submissionId ?? submission.submissionId,
            assets: (body as { assets?: unknown[] })?.assets ?? [] });
    });
    const signal = new AbortController().signal;
    assert.deepEqual(await api.uploadHomeworkAsset('asset-1', file, signal), metadata);
    await api.uploadTeacherAsset('asset-1', file, signal);
    for (let retry = 0; retry < 2; retry++) {
        await api.submitHomework({ lessonId: 9, submissionId: 'submission-1', answerHtml: '', file }, signal);
    }
    assert.equal(calls.length, 14);
    assert.deepEqual(calls.map(call => call.method), ['POST', 'PUT', 'POST', 'POST', 'PUT', 'POST',
        'POST', 'PUT', 'POST', 'POST', 'POST', 'PUT', 'POST', 'POST']);
    assert.deepEqual(calls.filter(call => call.path === '/assets/uploads').map(call =>
        ({ assetId: (call.body as { assetId: string }).assetId, uploadId: (call.body as { uploadId: string }).uploadId })), [
        { assetId: 'asset-1', uploadId: (calls[0].body as { uploadId: string }).uploadId },
        { assetId: 'asset-1', uploadId: (calls[0].body as { uploadId: string }).uploadId },
        { assetId: 'submission-1-attachment', uploadId: (calls[10].body as { uploadId: string }).uploadId },
        { assetId: 'submission-1-attachment', uploadId: (calls[6].body as { uploadId: string }).uploadId },
    ]);
    assert.equal((calls[1].body as { base64Data: string }).base64Data, 'AH+A/w==');
    assert.deepEqual(calls[9].body, { submissionId: 'submission-1', answerHtml: '', assets: [
        { ...metadata, assetId: 'submission-1-attachment', storageKey: 'submission-1-attachment', fileName: 'answer.png' },
    ] });
    assert.ok(calls.every(call => call.signal === signal));
    const reference = { ...metadata, storageKey: metadata.assetId };
    await api.submitHomework({ lessonId: 9, submissionId: 's', answerHtml: '', assets: [reference] });
    assert.deepEqual((calls[calls.length - 1]?.body as { assets: unknown[] }).assets, [reference]);
});

test('invalid submission is rejected before upload; upload failure prevents submission', async () => {
    const { api, calls } = setup();
    await assert.rejects(api.submitHomework({ lessonId: 0, submissionId: 's', answerHtml: '', file }), ZodError);
    await assert.rejects(api.submitHomework({ lessonId: 9, submissionId: 's', answerHtml: 'a'.repeat(100001), file }), ZodError);
    await assert.rejects(api.uploadHomeworkAsset('a', new File([], 'empty.png', { type: 'image/png' })));
    await assert.rejects(api.uploadHomeworkAsset('a', new File(['x'], 'unknown')));
    await assert.rejects(api.uploadHomeworkAsset('a', new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })));
    assert.equal(calls.length, 0);
    const rejected = setup(() => Response.json({ code: 'CONFLICT', message: 'Asset conflict', requestId: 'r' }, { status: 409 }));
    await assert.rejects(rejected.api.submitHomework({ lessonId: 9, submissionId: 's', answerHtml: '', file }), ApiError);
    assert.equal(rejected.calls.length, 1);
    const mismatch = setup(() => Response.json(metadata));
    await assert.rejects(mismatch.api.submitHomework({ lessonId: 9, submissionId: 's', answerHtml: '', file }), ApiError);
    assert.equal(mismatch.calls.length, 1);
});

test('chunked upload resumes at the server nextChunkIndex and keeps every request bounded', async () => {
    const bytes = new Uint8Array(512 * 1024 + 1);
    bytes[bytes.length - 1] = 42;
    const large = new File([bytes], 'large.png', { type: 'image/png' });
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    let uploadId = '';
    const { api, calls } = setup((path, body) => {
        if (path === '/assets/uploads') {
            const plan = body as { uploadId: string; assetId: string; chunkSize: number; totalChunks: number };
            uploadId = plan.uploadId;
            return Response.json({ ...plan, expiresAt: time, nextChunkIndex: 1, status: 'active' });
        }
        if (path.includes('/chunks/1')) return Response.json({ uploadId, assetId: 'large-asset', expiresAt: time,
            chunkSize: 512 * 1024, totalChunks: 2, nextChunkIndex: 2, status: 'active' });
        return Response.json({ assetId: 'large-asset', mimeType: 'image/png', bytes: bytes.length, sha256 });
    });
    assert.equal((await api.uploadTeacherAsset('large-asset', large)).bytes, bytes.length);
    assert.deepEqual(calls.map(call => call.path), [
        '/assets/uploads', `/assets/uploads/${uploadId}/chunks/1`, `/assets/uploads/${uploadId}/finalize`,
    ]);
    assert.equal((calls[1].body as { base64Data: string }).base64Data, 'Kg==');
    assert.ok(JSON.stringify(calls[1].body).length < 700_000);
});

test('asset downloads use authenticated client blobs and propagate download errors', async () => {
    const { api, calls } = setup(() => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } }));
    const signal = new AbortController().signal;
    const blob = await api.downloadHomeworkAsset('asset?1', signal);
    assert.equal(blob.type, 'image/png');
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 2]);
    assert.equal(calls[0].path, '/assets/asset%3F1');
    assert.equal(calls[0].signal, signal);
    const body = { code: 'FORBIDDEN', message: 'Denied', requestId: 'r' };
    await assert.rejects(setup(() => Response.json(body, { status: 403 })).api.downloadHomeworkAsset('a'), error => {
        assert.ok(error instanceof ApiError); assert.deepEqual(error.body, body); return true;
    });
});
