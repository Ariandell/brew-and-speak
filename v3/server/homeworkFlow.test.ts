import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';
import { createApiClient, ApiError } from '../src/api/client.js';
import { createHomeworkApi } from '../src/api/homeworkApi.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxHomeworkSchema } from './modules/homework/sandboxHomeworkRepository.js';
import { createSandboxHomeworkApp } from './createSandboxHomeworkApp.js';
import { createSandboxMediaApp } from './createSandboxMediaApp.js';

test('HTTP client → SQLite: real attachment, teacher feedback and cross-student isolation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'coffee-homework-flow-'));
    const url = `file:${join(root, 'test.sqlite')}`;
    const database = createSandboxWriteDatabase({ url, mode: 'sandbox' });
    const token = 'local-fixture-token';
    await database.batch([
        'CREATE TABLE users (id INTEGER PRIMARY KEY, telegram_id TEXT, name TEXT, username TEXT, role TEXT, is_blocked INTEGER, enrolled_course_id INTEGER)',
        "INSERT INTO users VALUES (7,'42','Student',NULL,'student',0,2),(8,'43','Other',NULL,'student',0,2),(9,'99','Teacher',NULL,'teacher',0,NULL)",
        'CREATE TABLE lessons (id INTEGER PRIMARY KEY, level_id INTEGER, title TEXT, "order" INTEGER)',
        "INSERT INTO lessons VALUES (10,2,'Coffee',1)",
        'CREATE TABLE lesson_blocks (id INTEGER PRIMARY KEY, lesson_id INTEGER, type TEXT, content TEXT, "order" INTEGER)',
        { sql: 'INSERT INTO lesson_blocks VALUES (100,10,?,?,0)', args: ['homework', JSON.stringify({ prompt: '<p>Write about coffee</p>' })] },
        'CREATE TABLE homework_submissions (id INTEGER PRIMARY KEY, user_id INTEGER, lesson_id INTEGER, text TEXT, file_url TEXT, file_name TEXT, status TEXT, grade INTEGER, feedback TEXT, submitted_at TEXT, updated_at TEXT)',
        'CREATE TABLE photo_messages (id INTEGER PRIMARY KEY, image_url TEXT, caption TEXT, scheduled_at TEXT)',
        'CREATE TABLE photo_message_views (id INTEGER PRIMARY KEY, user_id INTEGER, message_id INTEGER, viewed_at TEXT)',
        'CREATE TABLE app_assets (id TEXT PRIMARY KEY, mime_type TEXT, data TEXT)',
    ]);
    await initializeSandboxHomeworkSchema(database);
    const dependencies = { readDatabase: database, writeDatabase: database, writeDatabaseUrl: url, botToken: token };
    const media = createSandboxMediaApp(dependencies);
    const homework = createSandboxHomeworkApp(dependencies);
    const app = express();
    app.use((request, response, next) => /\/assets(?:\/|$)/.test(request.path) ? media(request, response, next) : homework(request, response, next));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const makeClient = (id: number) => {
        const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'Fixture' }) });
        const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
        const secret = createHmac('sha256', 'WebAppData').update(token).digest();
        params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
        return createHomeworkApi(createApiClient({ baseUrl: `http://127.0.0.1:${address.port}/api/v2`, getInitData: () => params.toString() }), '/sandbox');
    };
    try {
        const student = makeClient(42), teacher = makeClient(99), other = makeClient(43);
        const text = '%PDF-1.4\nfixture\n%%EOF';
        const input = { submissionId: 'real-homework', lessonId: 10, answerHtml: '<p>My answer.</p>', file: new File([text], 'worksheet.pdf', { type: 'application/pdf' }) };
        const submission = await student.submit(input);
        assert.equal(submission.userId, 7);
        assert.equal((await student.submit(input)).submissionId, submission.submissionId);
        assert.equal((await teacher.list(true)).items.length, 1);
        const assetId = submission.assets[0].assetId;
        assert.equal(await (await teacher.download(assetId)).text(), text);
        await assert.rejects(other.download(assetId), error => error instanceof ApiError && error.status === 404);
        assert.equal((await other.list(false)).items.length, 0);
        await assert.rejects(other.grade(submission.submissionId, 10, ''), error => error instanceof ApiError && error.status === 403);
        await teacher.grade(submission.submissionId, 8, 'Well done');
        const returned = (await student.list(false)).items[0];
        assert.equal(returned.grade, 8); assert.equal(returned.teacherComment, 'Well done');
        await teacher.grade(submission.submissionId, 9, 'Updated feedback');
        assert.equal((await student.list(false)).items[0].grade, 9);
        assert.equal(await (await student.download(assetId)).text(), text);
    } finally {
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        database.close();
    }
});
