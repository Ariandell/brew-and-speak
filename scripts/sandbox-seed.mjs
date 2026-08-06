// Builds a throwaway database for testing the app end to end.
//
//   node scripts/sandbox-seed.mjs
//   TURSO_DATABASE_URL=file:./sandbox/sandbox.sqlite npm start
//
// It writes to sandbox/sandbox.sqlite and touches nothing else: not production
// (which lives on Turso), not server/database.sqlite. The folder is gitignored.
//
// The course it creates carries one block of every type the app supports, plus
// the awkward shapes real content turned out to have - a gap marked with a
// single underscore, an answer padded with spaces, a quiz option left blank,
// and homework pasted in as HTML.

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(import.meta.dirname, '..', 'sandbox');
const FILE = path.join(DIR, 'sandbox.sqlite');

fs.mkdirSync(DIR, { recursive: true });
fs.rmSync(FILE, { force: true });

const db = createClient({ url: 'file:' + FILE.replace(/\\/g, '/') });

const run = (sql, args = []) => db.execute({ sql, args });

const schema = [
    `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT UNIQUE, name TEXT, username TEXT, role TEXT DEFAULT 'student', enrolled_course_id INTEGER, is_blocked INTEGER DEFAULT 0)`,
    `CREATE TABLE levels (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, "order" INTEGER DEFAULT 0)`,
    `CREATE TABLE lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, level_id INTEGER, title TEXT NOT NULL, theme_background TEXT DEFAULT 'default', "order" INTEGER DEFAULT 0)`,
    `CREATE TABLE lesson_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER, type TEXT NOT NULL, content TEXT NOT NULL, "order" INTEGER DEFAULT 0)`,
    `CREATE TABLE user_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, lesson_id INTEGER, status TEXT DEFAULT 'locked', homework_status TEXT DEFAULT 'none', unlocks_at DATETIME, completed_at DATETIME, score INTEGER DEFAULT 10, time_spent INTEGER DEFAULT 0, UNIQUE(user_id, lesson_id))`,
    `CREATE TABLE flashcards (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER, word TEXT NOT NULL, translation TEXT NOT NULL, example_phrase TEXT)`,
    `CREATE TABLE user_flashcard_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, flashcard_id INTEGER NOT NULL, times_shown INTEGER DEFAULT 0, times_correct INTEGER DEFAULT 0, times_wrong INTEGER DEFAULT 0, ease_factor REAL DEFAULT 2.5, interval_days INTEGER DEFAULT 0, next_review_at TEXT DEFAULT (datetime('now')), last_reviewed_at TEXT, UNIQUE(user_id, flashcard_id))`,
    `CREATE TABLE app_assets (id TEXT PRIMARY KEY, mime_type TEXT NOT NULL, data TEXT NOT NULL)`,
    `CREATE TABLE photo_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, image_url TEXT NOT NULL, caption TEXT, scheduled_at DATETIME NOT NULL, created_at DATETIME DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE photo_message_views (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, message_id INTEGER NOT NULL, viewed_at DATETIME DEFAULT (datetime('now','localtime')), UNIQUE(user_id, message_id))`,
    `CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL, text TEXT NOT NULL, created_at DATETIME DEFAULT (datetime('now','localtime')), is_read INTEGER DEFAULT 0)`,
    `CREATE TABLE homework_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, user_id INTEGER NOT NULL, text TEXT, file_url TEXT, file_name TEXT, submitted_at DATETIME DEFAULT (datetime('now','localtime')), updated_at DATETIME DEFAULT (datetime('now','localtime')), grade INTEGER, feedback TEXT, status TEXT DEFAULT 'pending')`,
];

const block = (lesson, order, type, content) =>
    run(`INSERT INTO lesson_blocks (lesson_id, type, content, "order") VALUES (?,?,?,?)`, [lesson, type, JSON.stringify(content), order]);

const main = async () => {
    for (const sql of schema) await run(sql);

    await run(`INSERT INTO levels (id, title, description, "order") VALUES (1,'Пісочниця A1','Курс для перевірки',1)`);

    await run(`INSERT INTO lessons (id, level_id, title, "order") VALUES (1,1,'Ранкова рутина',1)`);
    await run(`INSERT INTO lessons (id, level_id, title, "order") VALUES (2,1,'Смартфон і час',2)`);
    await run(`INSERT INTO lessons (id, level_id, title, "order") VALUES (3,1,'Кава на виніс',3)`);

    // Lesson 1: one of everything, including the shapes that used to break.
    await block(1, 1, 'text', { body: '<p><strong>Вправа 1 — читаємо разом:</strong></p><p>Every morning I wake up at seven.</p><ul><li>wake up — прокидатися</li><li>brush teeth — чистити зуби</li></ul>' });
    await block(1, 2, 'mascot_tip', { text: 'Ти сьогодні неймовірний чи неймовірна 😀', mood: 'happy' });
    await block(1, 3, 'quiz', {
        question: 'What do you do first in the morning?',
        // A blank option, exactly as one lesson in production has.
        options: [{ label: 'I wake up', isCorrect: true }, { label: 'I sleep', isCorrect: false }, { label: '', isCorrect: false }],
    });
    await block(1, 4, 'fill_blank', {
        prompt: 'Встав слово:',
        sentence: 'I _ up at seven every day.',   // single underscore, as teachers write it
        answer: ' wake ',                          // padded, as the editor used to save it
        options: ['wake', 'sleep', 'get'],
    });
    await block(1, 5, 'true_false', { statement: 'Coffee is a drink.', isTrue: true });
    await block(1, 6, 'word_order', { prompt: 'Склади речення:', sentence: 'I brush my teeth' });
    await block(1, 7, 'match_pairs', { prompt: 'Знайди пари:', pairs: [{ word: 'morning', translation: 'ранок' }, { word: 'sleep', translation: 'спати' }] });
    await block(1, 8, 'mascot_tip', { text: 'Не забувай натиснути синю кнопочку "Завершити урок"', mood: 'sad' });
    await block(1, 9, 'homework', {
        prompt: '<p>Переклад тексту 😉</p><p><br></p><p><strong>Вправа 1 — встав правильну форму:</strong></p><p>Yesterday I ______ to the gym. (go)</p><ul><li>She ______ a cake.</li></ul>',
        requiresReview: true,
    });

    await block(2, 1, 'text', { body: 'to scroll TikToks — дивитися відео\nto binge — залипнути\ncharger, battery, screen time' });
    await block(2, 2, 'homework', { prompt: 'Напиши 5 речень про свій смартфон.', requiresReview: true });

    await block(3, 1, 'text', { body: '<p>Ordering coffee: <em>Can I have a latte, please?</em></p>' });

    for (const [w, t] of [['wake up', 'прокидатися'], ['brush teeth', 'чистити зуби'], ['morning', 'ранок'], ['coffee', 'кава'], ['charger', 'зарядка']]) {
        await run(`INSERT INTO flashcards (lesson_id, word, translation) VALUES (1,?,?)`, [w, t]);
    }

    await run(`INSERT INTO users (id, telegram_id, name, username, role, enrolled_course_id) VALUES (1,'sandbox-teacher','Ольга (пісочниця)','olia16','teacher',1)`);
    await run(`INSERT INTO users (id, telegram_id, name, username, role, enrolled_course_id) VALUES (2,'sandbox-student','Тест Учень','test_student','student',1)`);
    await run(`INSERT INTO users (id, telegram_id, name, username, role, enrolled_course_id, is_blocked) VALUES (3,'sandbox-blocked','Заблокований Учень','blocked_one','student',1,1)`);

    // The student starts with lesson 1 open and nothing finished.
    await run(`INSERT INTO user_progress (user_id, lesson_id, status) VALUES (2,1,'unlocked')`);

    await run(`INSERT INTO messages (sender_id, receiver_id, text) VALUES (2,1,'Доброго дня! А коли наступний урок?')`);

    const counts = {};
    for (const t of ['levels', 'lessons', 'lesson_blocks', 'flashcards', 'users', 'messages']) {
        counts[t] = Number((await run(`SELECT COUNT(*) c FROM ${t}`)).rows[0].c);
    }
    console.log('Пісочниця готова: ' + FILE);
    console.log(Object.entries(counts).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
    console.log('\nЗапуск:  TURSO_DATABASE_URL=file:./sandbox/sandbox.sqlite npx tsx server/index.ts');
};

main().catch(e => { console.error(e); process.exit(1); });
