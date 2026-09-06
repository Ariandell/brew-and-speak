import assert from 'node:assert/strict';
import test from 'node:test';
import { clearProductionLessonSession, readProductionAttemptSession,
    writeProductionAttemptSession } from './productionAttemptSession.js';

const installStorage = () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
    } });
    return values;
};

test('production attempt session round-trips only display-safe progress', () => {
    installStorage();
    writeProductionAttemptSession(7, { attempts: { 10: 'attempt-10' }, outcomes: { 10: { 101: 'correct', 102: 'wrong' } } });
    assert.deepEqual(readProductionAttemptSession(7), {
        attempts: { 10: 'attempt-10' }, outcomes: { 10: { 101: 'correct', 102: 'wrong' } },
    });
    assert.deepEqual(readProductionAttemptSession(8), { attempts: {}, outcomes: {} });
});

test('production attempt session rejects malformed browser data and clears one lesson', () => {
    const values = installStorage();
    values.set('english-with-coffee:attempts:v1:7', JSON.stringify({
        attempts: { 10: 'valid', 0: 'bad', 11: '' },
        outcomes: { 10: { 101: 'correct', 102: 'forged' }, bad: { 1: 'wrong' } },
    }));
    assert.deepEqual(readProductionAttemptSession(7), {
        attempts: { 10: 'valid' }, outcomes: { 10: { 101: 'correct' } },
    });
    assert.deepEqual(clearProductionLessonSession(7, 10), { attempts: {}, outcomes: {} });
    values.set('english-with-coffee:attempts:v1:9', '{broken');
    assert.deepEqual(readProductionAttemptSession(9), { attempts: {}, outcomes: {} });
});
