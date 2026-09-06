import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from './client.js';
import { createProductApi } from './productApi.js';
import { getTelegramInitData } from './telegramInitData.js';

test('SDK acquisition requires initData and ignores URL, storage and initDataUnsafe identity', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not fetch without initData'); });
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
        else Reflect.deleteProperty(globalThis, 'window');
    });
    Reflect.deleteProperty(globalThis, 'window');
    assert.throws(getTelegramInitData, error => error instanceof ApiError && error.status === 401);
    for (const initData of [undefined, null, '', '   ', 7, {}]) {
        Object.defineProperty(globalThis, 'window', { configurable: true, value: {
            Telegram: { WebApp: { initData, initDataUnsafe: { user: { id: 1 } } } },
            get location() { throw new Error('Must not read URL identity'); },
            get localStorage() { throw new Error('Must not read stored identity'); },
        } });
        await assert.rejects(createProductApi().loadCurrentUser(), error => error instanceof ApiError && error.status === 401);
    }
});

test('default adapter acquires the current signed SDK payload on every request', async t => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
        else Reflect.deleteProperty(globalThis, 'window');
    });
    const webApp = { initData: 'user=%7B%22id%22%3A999%7D&hash=opaque' };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { Telegram: { WebApp: webApp } } });
    const headers: (string | null)[] = [];
    t.mock.method(globalThis, 'fetch', async (_url: unknown, options?: RequestInit) => {
        headers.push(new Headers(options?.headers).get('X-Telegram-Init-Data'));
        return Response.json({ userId: 7, name: 'Server identity', username: null, role: 'student',
            isBlocked: false, enrollment: { courseId: 2 }, capabilities: ['student:learn'] });
    });
    const api = createProductApi();
    assert.equal((await api.loadCurrentUser()).id, 7);
    webApp.initData = 'updated-signed-payload';
    await api.loadCurrentUser();
    assert.deepEqual(headers, ['user=%7B%22id%22%3A999%7D&hash=opaque', 'updated-signed-payload']);
});
