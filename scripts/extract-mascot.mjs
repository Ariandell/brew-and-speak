// Pulls everything downloadable out of a deployment: the HTML, every bundle it
// references, and every asset path those bundles mention. Written to recover the
// mascot artwork from the March 20 deployment (commit 03f75b8), whose source is
// gone from GitHub but whose build is still served by Vercel.
//
//   node scripts/extract-mascot.mjs https://telegram-mini-app-gamma-eight.vercel.app
//
// Read-only: it issues GET requests and writes into a local folder.

import fs from 'fs';
import path from 'path';

const BASE = (process.argv[2] || 'https://telegram-mini-app-gamma-eight.vercel.app').replace(/\/$/, '');
const OUT = path.resolve(import.meta.dirname, '..', 'recovered');

const MEDIA = /\.(png|jpe?g|gif|webp|svg|webm|mp4|mov|m4v|ogg|mp3|json|lottie)/i;

const save = (name, buf) => {
    const file = path.join(OUT, name.replace(/[^\w.-]/g, '_'));
    fs.writeFileSync(file, buf);
    return file;
};

const grab = async (url) => {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    return { type, buf: Buffer.from(await res.arrayBuffer()) };
};

const main = async () => {
    fs.mkdirSync(OUT, { recursive: true });
    console.log(`Витягую з ${BASE}`);

    const index = await grab(BASE + '/');
    if (!index) return console.error('Не відповідає.');
    const html = index.buf.toString('utf8');

    if (/<title>\s*Login\s*–\s*Vercel/i.test(html)) {
        return console.error('ЩЕ ПІД ЗАХИСТОМ — це сторінка входу Vercel, не додаток.');
    }
    save('index.html', index.buf);
    console.log(`index.html — ${html.length} байт`);

    // Bundles the page loads, plus anything under /assets/ they in turn mention.
    const refs = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]));
    const bundles = [...refs].filter(u => /\.(js|css)$/.test(u));
    console.log(`бандлів: ${bundles.length}`);

    const assetPaths = new Set();
    for (const b of bundles) {
        const url = b.startsWith('http') ? b : BASE + (b.startsWith('/') ? b : '/' + b);
        const got = await grab(url);
        if (!got) { console.log(`  пропущено ${b}`); continue; }
        const name = b.split('/').pop();
        save(name, got.buf);
        const text = got.buf.toString('utf8');
        console.log(`  ${name} — ${(got.buf.length / 1024).toFixed(0)} КБ`);

        // Absolute paths and bare filenames that look like media.
        for (const m of text.matchAll(/["'`]([^"'`\s]*\.(?:png|jpe?g|gif|webp|svg|webm|mp4|mov|m4v|ogg|mp3|json|lottie))["'`]/gi)) {
            assetPaths.add(m[1]);
        }
        // Anything mentioning the mascot by name, whatever the extension.
        for (const m of text.matchAll(/["'`]([^"'`\s]{0,80}(?:mascot|cat|kot|кіт|кот)[^"'`\s]{0,40})["'`]/gi)) {
            assetPaths.add(m[1]);
        }
    }

    const candidates = [...assetPaths].filter(p => !p.startsWith('data:') && !p.startsWith('http'));
    console.log(`\nкандидатів у файли: ${candidates.length}`);

    let saved = 0;
    for (const p of candidates) {
        const url = BASE + (p.startsWith('/') ? p : '/' + p);
        const got = await grab(url);
        // The catch-all rewrite answers 200 with index.html for anything missing,
        // so only keep responses that are actually not HTML.
        if (!got || got.type.includes('text/html')) continue;
        const file = save(p.split('/').pop() || 'asset', got.buf);
        console.log(`  ЗБЕРЕЖЕНО ${path.basename(file)}  ${got.type}  ${(got.buf.length / 1024).toFixed(0)} КБ`);
        saved++;
    }

    console.log(`\nфайлів дістав: ${saved}`);
    console.log(`Папка: ${OUT}`);
    if (!saved) console.log('Медіа не знайшлось у бандлах — можливо, шляхи будуються динамічно. Надішли скріншот, шукатиму інакше.');
};

main().catch(e => { console.error('Помилка:', e.message); process.exit(1); });
