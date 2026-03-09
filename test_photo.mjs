// Test script: POST a tiny image to the photo-messages API and then GET all messages
const BASE = 'https://brew-and-speak.onrender.com';

async function test() {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    const boundary = '----FormBoundary' + Date.now();
    const parts = [];

    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`);
    parts.push(pngBuffer);
    parts.push('\r\n');
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\nTest photo\r\n`);
    parts.push(`--${boundary}--\r\n`);

    const body = Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));

    console.log('1. POST /api/photo-messages ...');
    const postRes = await fetch(`${BASE}/api/photo-messages`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: body
    });
    console.log('   Status:', postRes.status);
    console.log('   Body:', await postRes.text());

    console.log('2. GET /api/photo-messages ...');
    const getRes = await fetch(`${BASE}/api/photo-messages`);
    console.log('   Status:', getRes.status);
    console.log('   Body:', await getRes.text());
}

test().catch(e => console.error('ERROR:', e));
