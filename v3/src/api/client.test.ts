import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { ApiError, createApiClient } from './client.js';

test('API requests time out instead of leaving the product loader forever', async () => {
  const client = createApiClient({
    getInitData: () => 'signed',
    requestTimeoutMs: 5,
    fetcher: (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }),
  });
  await assert.rejects(client.request('/slow', z.object({ ok: z.boolean() })), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 408);
    assert.match(error.message, /Сервер не відповідає/);
    return true;
  });
});

test('caller cancellation remains distinct from a network timeout', async () => {
  const controller = new AbortController();
  const reason = new Error('screen left');
  const client = createApiClient({
    getInitData: () => 'signed',
    requestTimeoutMs: 1000,
    fetcher: (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }),
  });
  const request = client.download('/asset', controller.signal);
  controller.abort(reason);
  await assert.rejects(request, error => error === reason);
});
