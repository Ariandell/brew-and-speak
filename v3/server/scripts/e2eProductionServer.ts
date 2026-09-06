import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductionApp } from '../createProductionApp.js';
import { createReadOnlyDatabase } from '../infrastructure/db/readOnlySql.js';
import { applyV3MigrationPlan } from '../infrastructure/db/sandboxMigrationPlan.js';
import { createWriteDatabase } from '../infrastructure/db/writeSql.js';

const E2E_BOT_TOKEN = 'english-with-coffee-local-production-e2e-token';
const E2E_PORT = 3000;

if (process.env.E2E_PRODUCTION_HARNESS !== '1') {
  throw new Error('Refusing to start the production E2E harness without E2E_PRODUCTION_HARNESS=1');
}

const here = dirname(fileURLToPath(import.meta.url));
const v3Root = join(here, '..', '..');
const temporaryDirectory = join(v3Root, '.tmp-e2e');
const databasePath = join(temporaryDirectory, 'production-ui.sqlite');
const databaseUrl = `file:${databasePath}`;
if (!databasePath.startsWith(temporaryDirectory) || !databaseUrl.startsWith('file:')) {
  throw new Error('Production E2E database must stay inside v3/.tmp-e2e');
}

const block = (value: unknown) => JSON.stringify(value);
const now = new Date();
const past = new Date(now.getTime() - 60_000).toISOString();
const future = new Date(now.getTime() + 86_400_000).toISOString();

const legacySchema = [
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    username TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    is_blocked INTEGER NOT NULL DEFAULT 0,
    enrolled_course_id INTEGER
  )`,
  `CREATE TABLE levels (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL
  )`,
  `CREATE TABLE lessons (
    id INTEGER PRIMARY KEY,
    level_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    "order" INTEGER NOT NULL
  )`,
  `CREATE TABLE lesson_blocks (
    id INTEGER PRIMARY KEY,
    lesson_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    "order" INTEGER NOT NULL
  )`,
  `CREATE TABLE user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    status TEXT,
    homework_status TEXT,
    unlocks_at TEXT,
    completed_at TEXT,
    score INTEGER,
    time_spent INTEGER
  )`,
  `CREATE TABLE homework_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    file_url TEXT,
    file_name TEXT,
    submitted_at TEXT NOT NULL,
    updated_at TEXT,
    grade INTEGER,
    feedback TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
  )`,
  `CREATE TABLE flashcards (
    id INTEGER PRIMARY KEY,
    lesson_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    example_phrase TEXT
  )`,
  `CREATE TABLE user_flashcard_progress (
    user_id TEXT NOT NULL,
    flashcard_id INTEGER NOT NULL,
    times_shown INTEGER NOT NULL DEFAULT 0,
    times_correct INTEGER NOT NULL DEFAULT 0,
    times_wrong INTEGER NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT,
    last_reviewed_at TEXT,
    UNIQUE(user_id, flashcard_id)
  )`,
  `CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE photo_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    caption TEXT,
    scheduled_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE photo_message_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    viewed_at TEXT NOT NULL,
    UNIQUE(user_id, message_id)
  )`,
  `CREATE TABLE app_assets (
    id TEXT PRIMARY KEY,
    mime_type TEXT NOT NULL,
    data TEXT NOT NULL
  )`,
] as const;

const seed = async () => {
  await mkdir(temporaryDirectory, { recursive: true });
  // This harness owns exactly this one SQLite file. No directory or wildcard deletion is allowed.
  await rm(databasePath, { force: true });
  const database = createWriteDatabase({ url: databaseUrl });
  await database.batch(legacySchema);
  await database.batch([
    { sql: `INSERT INTO users (id, telegram_id, name, username, role, is_blocked, enrolled_course_id)
      VALUES (900, '90001', 'Викладачка', 'coffee_teacher', 'teacher', 0, NULL),
             (101, '10101', 'Андрій', 'andrii_student', 'student', 0, 1),
             (102, '10202', 'Марія', 'maria_student', 'student', 0, 1)`, args: [] },
    { sql: `INSERT INTO levels (id, title, description, "order")
      VALUES (1, 'Intermediate English', 'Жива англійська для впевненого спілкування.', 1)`, args: [] },
    { sql: `INSERT INTO lessons (id, level_id, title, "order") VALUES (1, 1, 'Present Perfect', 1)`, args: [] },
    { sql: `INSERT INTO lesson_blocks (id, lesson_id, type, content, "order") VALUES
      (101, 1, 'quiz', ?, 0),
      (102, 1, 'fill_blank', ?, 1),
      (103, 1, 'true_false', ?, 2),
      (104, 1, 'word_order', ?, 3),
      (105, 1, 'match_pairs', ?, 4),
      (106, 1, 'homework', ?, 5)`, args: [
        block({ question: 'Оберіть правильне речення', options: ['I have finished my coffee.', 'I has finished my coffee.'], correctAnswer: 'I have finished my coffee.' }),
        block({ sentence: 'She ___ already arrived.', options: ['has', 'have'], correctAnswer: 'has' }),
        block({ statement: 'Present Perfect завжди називає точний час у минулому.', correct: false }),
        block({ words: ['ever', 'you', 'Have', 'London?', 'visited'], sentence: 'Have you ever visited London?' }),
        block({ pairs: [{ left: 'already', right: 'вже' }, { left: 'yet', right: 'ще' }, { left: 'ever', right: 'коли-небудь' }] }),
        block({ prompt: '<p>Напиши п’ять речень про свій тиждень.</p>' }),
      ] },
    { sql: `INSERT INTO user_progress (user_id, lesson_id, status, unlocks_at)
      VALUES (101, 1, 'unlocked', NULL), (102, 1, 'unlocked', NULL)`, args: [] },
    { sql: `INSERT INTO flashcards (id, lesson_id, word, translation, example_phrase) VALUES
      (1, 1, 'already', 'вже', 'I have already finished.'),
      (2, 1, 'yet', 'ще / вже', 'Have you finished yet?'),
      (3, 1, 'ever', 'коли-небудь', 'Have you ever been there?')`, args: [] },
    { sql: `INSERT INTO messages (sender_id, receiver_id, text, created_at, is_read)
      VALUES (900, 101, 'Привіт, Андрію!', ?, 1), (102, 900, 'Повідомлення лише від Марії', ?, 0)`, args: [past, past] },
    { sql: `INSERT INTO app_assets (id, mime_type, data) VALUES ('legacy-pixel', 'image/png', ?)`, args: [
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ] },
    { sql: `INSERT INTO photo_messages (id, image_url, caption, scheduled_at, created_at)
      VALUES (1, '/api/assets/legacy-pixel', 'Майбутнє повідомлення', ?, ?)`, args: [future, past] },
  ]);
  await applyV3MigrationPlan(database);
  return database;
};

const database = await seed();
const readDatabase = createReadOnlyDatabase({ url: databaseUrl });
const app = createProductionApp({
  readDatabase,
  writeDatabase: database,
  databaseUrl,
  botToken: E2E_BOT_TOKEN,
  writesEnabled: true,
});
const server = app.listen(E2E_PORT, '127.0.0.1', () => {
  console.log(`production-e2e-api ready at http://127.0.0.1:${E2E_PORT}`);
});

const close = () => server.close(() => {
  database.close();
  void rm(databasePath, { force: true }).finally(() => process.exit(0));
});
process.once('SIGINT', close);
process.once('SIGTERM', close);
