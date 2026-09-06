import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('production HTML loads the Telegram SDK and CSP permits only its official origin', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const vercel = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8')) as {
        headers: Array<{ headers: Array<{ key: string; value: string }> }>;
    };
    const policy = vercel.headers.flatMap(group => group.headers)
        .find(header => header.key === 'Content-Security-Policy')?.value ?? '';

    assert.match(html, /<script src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"><\/script>/);
    assert.match(policy, /script-src 'self' https:\/\/telegram\.org(?:;|\s)/);
});
