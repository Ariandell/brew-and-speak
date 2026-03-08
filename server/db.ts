import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, 'database.sqlite');

// Connect to Turso if credentials exist, otherwise fallback to local SQLite file
export const dbRaw = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${dbPath}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDB() {
  try {
    // Users
    await dbRaw.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE,
      name TEXT,
      role TEXT DEFAULT 'student',
      enrolled_course_id INTEGER
    )
  `);
    // Add column if it doesn't exist (migration for existing DBs)
    try { await dbRaw.execute(`ALTER TABLE users ADD COLUMN enrolled_course_id INTEGER`); } catch { }

    // Levels (Map Zones)
    await dbRaw.execute(`
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      "order" INTEGER DEFAULT 0
    )
  `);

    // Lessons (Nodes on Map)
    await dbRaw.execute(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER,
      title TEXT NOT NULL,
      theme_background TEXT DEFAULT 'default', 
      "order" INTEGER DEFAULT 0,
      FOREIGN KEY (level_id) REFERENCES levels (id)
    )
  `);

    // Lesson Blocks (Content pieces)
    await dbRaw.execute(`
    CREATE TABLE IF NOT EXISTS lesson_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      "order" INTEGER DEFAULT 0,
      FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    )
  `);

    // User Progress (Tracking completion and unlocks)
    await dbRaw.execute(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      lesson_id INTEGER,
      status TEXT DEFAULT 'locked', -- locked, unlocked, completed
      homework_status TEXT DEFAULT 'none', 
      unlocks_at DATETIME, -- For the 24h marathon drip logic
      completed_at DATETIME,
      score INTEGER DEFAULT 10,
      time_spent INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (lesson_id) REFERENCES lessons (id),
      UNIQUE(user_id, lesson_id)
    )
  `);
    // Add score and time_spent columns for existing DBs
    try { await dbRaw.execute(`ALTER TABLE user_progress ADD COLUMN score INTEGER DEFAULT 10`); } catch { }
    try { await dbRaw.execute(`ALTER TABLE user_progress ADD COLUMN time_spent INTEGER DEFAULT 0`); } catch { }

    // Flashcards (Vocabulary for lessons)
    await dbRaw.execute(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      word TEXT NOT NULL,
      translation TEXT NOT NULL,
      example_phrase TEXT,
      FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    )
  `);

    // SRS progress per user per flashcard (Anki-style spaced repetition)
    await dbRaw.execute(`
    CREATE TABLE IF NOT EXISTS user_flashcard_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      flashcard_id INTEGER NOT NULL,
      times_shown INTEGER DEFAULT 0,
      times_correct INTEGER DEFAULT 0,
      times_wrong INTEGER DEFAULT 0,
      ease_factor REAL DEFAULT 2.5,
      interval_days INTEGER DEFAULT 0,
      next_review_at TEXT DEFAULT (datetime('now')),
      last_reviewed_at TEXT,
      UNIQUE(user_id, flashcard_id),
      FOREIGN KEY (flashcard_id) REFERENCES flashcards (id)
    )
  `);

    // Photo Messages (Scheduled photo deliveries from teacher)
    // Photo Message Views (Track which students have seen which messages)
    // Messages (Direct messages between users)
    await dbRaw.executeMultiple(`
    CREATE TABLE IF NOT EXISTS photo_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      caption TEXT,
      scheduled_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS photo_message_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      viewed_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (message_id) REFERENCES photo_messages (id),
      UNIQUE(user_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      is_read INTEGER DEFAULT 0,
      FOREIGN KEY (sender_id) REFERENCES users (id),
      FOREIGN KEY (receiver_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS homework_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT,
      file_url TEXT,
      file_name TEXT,
      submitted_at DATETIME DEFAULT (datetime('now', 'localtime')),
      grade INTEGER,
      feedback TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (lesson_id) REFERENCES lessons (id)
    );
  `);

    // Migration for homework_submissions to add grading columns if they don't exist
    try {
      await dbRaw.execute("ALTER TABLE homework_submissions ADD COLUMN grade INTEGER");
      await dbRaw.execute("ALTER TABLE homework_submissions ADD COLUMN feedback TEXT");
      await dbRaw.execute("ALTER TABLE homework_submissions ADD COLUMN status TEXT DEFAULT 'pending'");
    } catch (e) {
      // Ignore if columns already exist
    }

  } catch (error) {
    console.error('Failed to initialize Turso/SQLite DB:', error);
  }
}

initDB();

// Helper for synchronous-like reads mapped to better-sqlite3 style for the MVP
export const db = {
  prepare: (sql: string) => {
    return {
      all: async (...params: any[]) => {
        const result = await dbRaw.execute({ sql, args: params });
        return result.rows;
      },
      get: async (...params: any[]) => {
        const result = await dbRaw.execute({ sql, args: params });
        return result.rows[0] || undefined;
      },
      run: async (...params: any[]) => {
        const result = await dbRaw.execute({ sql, args: params });
        return {
          lastInsertRowid: result.lastInsertRowid?.toString(),
          changes: result.rowsAffected
        };
      }
    };
  }
};
