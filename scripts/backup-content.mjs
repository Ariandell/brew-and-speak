// Read-only snapshot of everything the API will hand over: courses, lessons,
// blocks, vocabulary, homework submissions and photo messages.
//
//   node scripts/backup-content.mjs
//   node scripts/backup-content.mjs https://some-other-deploy.vercel.app
//
// Writes backups/content-<timestamp>.json. That folder is gitignored on
// purpose - submissions carry student names and Telegram ids, so the snapshot
// must never be pushed to GitHub. Keep it somewhere private.

import fs from 'fs';
import path from 'path';

const BASE = (process.argv[2] || 'https://telegram-mini-app-gamma-eight.vercel.app').replace(/\/$/, '');
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'backups');

const get = async (endpoint) => {
    const res = await fetch(BASE + endpoint);
    if (!res.ok) throw new Error(`${res.status} ${endpoint}`);
    return res.json();
};

// Endpoints that may legitimately be empty or unavailable shouldn't abort the run.
const tryGet = async (endpoint) => {
    try { return await get(endpoint); } catch (e) { return { __error: String(e.message) }; }
};

const main = async () => {
    console.log(`Знімаю бекап з ${BASE}`);

    const levels = await get('/api/levels');
    const courses = [];

    for (const level of levels) {
        const lessons = await get(`/api/levels/${level.id}/lessons`);
        const detailed = [];
        for (const lesson of (Array.isArray(lessons) ? lessons : [])) {
            detailed.push({
                ...lesson,
                blocks: await tryGet(`/api/lessons/${lesson.id}/blocks`),
                flashcards: await tryGet(`/api/lessons/${lesson.id}/flashcards`),
            });
            process.stdout.write('.');
        }
        courses.push({ ...level, lessons: detailed });
    }
    process.stdout.write('\n');

    const snapshot = {
        takenAt: new Date().toISOString(),
        source: BASE,
        courses,
        homework: await tryGet('/api/admin/homework'),
        photoMessages: await tryGet('/api/photo-messages'),
        statistics: await tryGet('/api/admin/statistics'),
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `content-${snapshot.takenAt.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 1));

    const lessonCount = courses.reduce((n, c) => n + c.lessons.length, 0);
    const blockCount = courses.reduce((n, c) => n + c.lessons.reduce((m, l) => m + (Array.isArray(l.blocks) ? l.blocks.length : 0), 0), 0);
    const hwCount = Array.isArray(snapshot.homework) ? snapshot.homework.length : 0;

    console.log(`курсів ${courses.length} | уроків ${lessonCount} | блоків ${blockCount} | зданих ДЗ ${hwCount}`);
    console.log(`Збережено: ${file}`);
    console.log(`Розмір: ${(fs.statSync(file).size / 1024).toFixed(0)} КБ`);
};

main().catch(e => { console.error('Бекап не вдався:', e.message); process.exit(1); });
