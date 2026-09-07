import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVocabulary } from './generateVocabulary.js';

test('vocabulary generation returns validated drafts and rejects malformed provider output', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-only-key';
    const lesson = { id: 1, courseId: 1, title: 'Coffee', order: 1, contentRevision: 'draft-1', blocks: [], origin: 'v3' as const };
    try {
        globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [{ front: 'coffee', back: 'кава' }] }) }] } }] }), { status: 200 });
        assert.deepEqual(await generateVocabulary(lesson), { items: [{ front: 'coffee', back: 'кава' }] });
        globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 });
        await assert.rejects(generateVocabulary(lesson));
        globalThis.fetch = async () => new Response('', { status: 429 });
        await assert.rejects(generateVocabulary(lesson));
    } finally {
        globalThis.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    }
});
