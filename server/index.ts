import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { db, dbRaw } from './db.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend in production
const distDir = resolve(__dirname, '../dist');
if (existsSync(distDir)) {
    app.use(express.static(distDir));
}

// --- File Uploads Config ---
const uploadsDir = resolve(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB max

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// --- Generic file upload (for lesson assets — NOT broadcast messages) ---
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/${req.file.filename}` });
});

// --- Student enrollment API ---

// Sync user on init
app.post('/api/users/sync', async (req, res) => {
    try {
        const { id, username, first_name, last_name } = req.body;
        if (!id) return res.status(400).json({ error: 'User ID required' });

        const name = [first_name, last_name].filter(Boolean).join(' ') || username || 'Unknown';

        // Upsert user to ensure they exist in DB
        // If they already exist, we just update their name/username in case it changed
        await db.prepare(`
            INSERT INTO users (telegram_id, name) VALUES (?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET name = ?
        `).run(id.toString(), name, name);

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to sync user:', error);
        res.status(500).json({ error: 'Failed to sync user' });
    }
});

// Enroll a student in a course
app.post('/api/users/:userId/enroll', async (req, res) => {
    try {
        const { userId } = req.params;
        const { courseId } = req.body;
        if (!courseId) return res.status(400).json({ error: 'courseId required' });

        // Upsert user with enrolled_course_id
        await db.prepare(`
            INSERT INTO users (telegram_id, enrolled_course_id) VALUES (?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET enrolled_course_id = ?
        `).run(userId, courseId, courseId);

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to enroll:', error);
        res.status(500).json({ error: 'Failed to enroll' });
    }
});

// Get a student's enrolled course
app.get('/api/users/:userId/enrollment', async (req, res) => {
    try {
        const user = await db.prepare(`SELECT id, enrolled_course_id FROM users WHERE telegram_id = ?`).get(req.params.userId);
        if (!user || !user.enrolled_course_id) return res.json({ courseId: null });

        const course = await db.prepare(`
            SELECT l.*, COUNT(ls.id) as lesson_count FROM levels l
            LEFT JOIN lessons ls ON ls.level_id = l.id
            WHERE l.id = ?
            GROUP BY l.id
        `).get(user.enrolled_course_id);

        const progress = await db.prepare(`
            SELECT COUNT(*) as count FROM user_progress p
            JOIN lessons l ON p.lesson_id = l.id
            WHERE p.user_id = ? AND l.level_id = ? AND p.status = 'completed'
        `).get(user.id, user.enrolled_course_id);

        res.json({
            courseId: user.enrolled_course_id,
            course: course || null,
            completedLessons: progress ? progress.count : 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch enrollment' });
    }
});



// Basic seed capability for testing
app.post('/api/seed', async (req, res) => {
    try {
        await db.prepare('INSERT INTO levels (title, "order") VALUES (?, ?)').run('Основи', 1);
        const levelRes = await db.prepare('SELECT id FROM levels ORDER BY id DESC LIMIT 1').get();
        const levelId = levelRes.id;

        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(levelId, 'Кава', 'cafe', 1);
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(levelId, 'Місто', 'city', 2);

        res.json({ success: true, message: 'Seeded test data' });
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// --- Sequential Lesson Path API ---

// Get the full course path and user progress for the enrolled course
app.get('/api/courses/:courseId/path/:userId', async (req, res) => {
    try {
        const { courseId, userId } = req.params;

        const user = await db.prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(userId);
        const internalId = user ? user.id : userId; // Fallback for local dev if missing

        const lessons = await db.prepare('SELECT * FROM lessons WHERE level_id = ? ORDER BY "order" ASC').all(courseId);
        const progressList = await db.prepare('SELECT * FROM user_progress WHERE user_id = ?').all(internalId);

        const progressMap: Record<number, any> = {};
        progressList.forEach((p: any) => progressMap[p.lesson_id] = p);

        const courseLessonIds = new Set(lessons.map((l: any) => l.id));
        const hasAnyProgress = progressList.some((p: any) => courseLessonIds.has(p.lesson_id));

        const path = lessons.map((lesson: any, idx: number) => {
            let prog = progressMap[lesson.id];
            let status = 'locked';
            let unlocksAt = null;
            let completedAt = null;

            if (prog) {
                status = prog.status;
                unlocksAt = prog.unlocks_at;
                completedAt = prog.completed_at;

                // Auto-unlock check
                if (status === 'locked' && unlocksAt) {
                    const now = new Date();
                    const unlockDate = new Date(unlocksAt);
                    if (now >= unlockDate) {
                        db.prepare(`UPDATE user_progress SET status = 'unlocked' WHERE id = ?`).run(prog.id);
                        status = 'unlocked';
                    }
                }
            } else if (idx === 0 && !hasAnyProgress) {
                status = 'unlocked';
            }

            return {
                ...lesson,
                status,
                unlocks_at: unlocksAt,
                completed_at: completedAt
            };
        });

        res.json(path);
    } catch (error) {
        console.error('Failed to fetch course path:', error);
        res.status(500).json({ error: 'Failed to fetch course path' });
    }
});

// --- Legacy Active Lesson API ---
app.get('/api/lessons/active/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        // 1. Get user's enrolled course
        const user = await db.prepare(`SELECT id, enrolled_course_id FROM users WHERE telegram_id = ?`).get(userId);
        if (!user || !user.enrolled_course_id) {
            return res.status(404).json({ error: 'User is not enrolled in any course' });
        }
        const courseId = user.enrolled_course_id;
        const internalId = user.id;

        // 2. Find last unlocked/completed lesson for user IN THIS COURSE
        const progress = await db.prepare(`
            SELECT p.* FROM user_progress p
            JOIN lessons l ON p.lesson_id = l.id
            WHERE p.user_id = ? AND l.level_id = ?
            ORDER BY l."order" DESC LIMIT 1
        `).get(internalId, courseId);

        // 3. If no progress, return the very first lesson of THIS course
        if (!progress) {
            const firstLesson = await db.prepare(`SELECT * FROM lessons WHERE level_id = ? ORDER BY "order" ASC LIMIT 1`).get(courseId);
            if (!firstLesson) return res.json({ currentLesson: null, status: 'locked' }); // Course has no lessons yet
            return res.json({ currentLesson: firstLesson, status: 'unlocked' });
        }

        // 4. Check if locked by timer
        if (progress.status === 'locked' && progress.unlocks_at) {
            const now = new Date();
            const unlocksAtRaw = progress.unlocks_at as string | number | Date;
            const unlockDate = new Date(Number(unlocksAtRaw) || unlocksAtRaw);

            if (now >= unlockDate) {
                // Time passed, auto-unlock
                await db.prepare(`UPDATE user_progress SET status = 'unlocked' WHERE id = ?`).run(progress.id);
                progress.status = 'unlocked';
            }
        }

        const activeLesson = await db.prepare(`SELECT * FROM lessons WHERE id = ?`).get(progress.lesson_id);

        res.json({
            currentLesson: activeLesson,
            status: progress.status,
            homework_status: progress.homework_status,
            unlocks_at: progress.unlocks_at
        });
    } catch (error) {
        console.error('Failed to fetch active lesson:', error);
        res.status(500).json({ error: 'Failed to fetch active lesson' });
    }
});

// --- Homework Submission & Drip Logic ---
app.post('/api/lessons/:lessonId/finish', async (req, res) => {
    try {
        const { userId, needsTeacherReview, score = 10, timeSpent = 60 } = req.body;
        const lessonId = req.params.lessonId;

        const user = await db.prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const internalId = user.id;

        // Mark current as completed
        await db.prepare(`
            INSERT INTO user_progress (user_id, lesson_id, status, homework_status, completed_at, score, time_spent) 
            VALUES (?, ?, 'completed', ?, datetime('now'), ?, ?)
            ON CONFLICT(user_id, lesson_id) DO UPDATE SET status='completed', homework_status=?, completed_at=datetime('now'), score=?, time_spent=time_spent+?
        `).run(internalId, lessonId, needsTeacherReview ? 'pending' : 'approved', score, timeSpent, needsTeacherReview ? 'pending' : 'approved', score, timeSpent);

        // Sync dictionary flashcards to SRS
        const flashcards = await db.prepare('SELECT id FROM flashcards WHERE lesson_id = ?').all(lessonId);
        for (const fc of flashcards) {
            await db.prepare(`
                INSERT OR IGNORE INTO user_flashcard_progress (user_id, flashcard_id, next_review_at)
                VALUES (?, ?, datetime('now'))
            `).run(userId, fc.id); // user_flashcard_progress uses telegram_id (userId)
        }

        // Find next lesson in the SAME course
        const currentLesson = await db.prepare(`SELECT "order", level_id FROM lessons WHERE id = ?`).get(lessonId);
        if (!currentLesson) return res.status(404).json({ error: 'Lesson not found' });

        const nextLesson = await db.prepare(`
            SELECT * FROM lessons 
            WHERE level_id = ? AND "order" > ? 
            ORDER BY "order" ASC LIMIT 1
        `).get(currentLesson.level_id, currentLesson.order);

        if (nextLesson) {
            // Create lock entry for the next lesson (drip content 24h). 
            // Use INSERT OR IGNORE so re-taking old lessons doesn't crash or re-lock unlocked stuff.
            await db.prepare(`
                 INSERT OR IGNORE INTO user_progress (user_id, lesson_id, status, unlocks_at) 
                 VALUES (?, ?, 'locked', datetime('now', '+24 hours'))
             `).run(internalId, nextLesson.id);
        }

        res.json({ success: true, nextLessonId: nextLesson?.id });
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete lesson' });
    }
});

// --- Flashcards API ---
app.get('/api/lessons/:lessonId/flashcards', async (req, res) => {
    try {
        const flashcards = await db.prepare('SELECT * FROM flashcards WHERE lesson_id = ?').all(req.params.lessonId);
        res.json(flashcards);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch flashcards' });
    }
});

// --- Legacy Generic Lesson View API ---
app.get('/api/lessons/:id', async (req, res) => {
    try {
        const lesson = await db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
        if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

        const blocks = await db.prepare('SELECT * FROM lesson_blocks WHERE lesson_id = ? ORDER BY "order" ASC').all();
        const flashcards = await db.prepare('SELECT * FROM flashcards WHERE lesson_id = ?').all(req.params.id);

        const parsedBlocks = blocks.map((b: any) => ({
            ...b,
            content: JSON.parse(b.content)
        }));

        res.json({ ...lesson, blocks: parsedBlocks, flashcards });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lesson' });
    }
});

// --- Photo Messages API ---

// Create a new photo message (admin uploads photo, goes live immediately)
app.post('/api/photo-messages', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

        const { caption } = req.body;
        const imageUrl = `/uploads/${req.file.filename}`;

        const result = await db.prepare(
            'INSERT INTO photo_messages (image_url, caption, scheduled_at) VALUES (?, ?, datetime("now", "localtime"))'
        ).run(imageUrl, caption || '');

        res.json({ success: true, id: result.lastInsertRowid, image_url: imageUrl });
    } catch (error) {
        console.error('Failed to create photo message:', error);
        res.status(500).json({ error: 'Failed to create photo message' });
    }
});

// List all photo messages (for admin panel)
app.get('/api/photo-messages', async (_req, res) => {
    try {
        const messages = await db.prepare('SELECT * FROM photo_messages ORDER BY scheduled_at DESC').all();
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch photo messages' });
    }
});

// Delete a photo message
app.delete('/api/photo-messages/:id', async (req, res) => {
    try {
        await db.prepare('DELETE FROM photo_message_views WHERE message_id = ?').run(req.params.id);
        await db.prepare('DELETE FROM photo_messages WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete photo message' });
    }
});

// Get pending (unseen) photo messages for a student
app.get('/api/photo-messages/pending/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await db.prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(userId);
        const internalId = user ? user.id : userId;

        const messages = await db.prepare(`
            SELECT pm.* FROM photo_messages pm
            WHERE pm.id NOT IN (
                SELECT message_id FROM photo_message_views WHERE user_id = ?
            )
            ORDER BY pm.created_at ASC
        `).all(internalId);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending messages' });
    }
});

// Mark a photo message as viewed by a student
app.post('/api/photo-messages/:id/viewed', async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await db.prepare(`SELECT id FROM users WHERE telegram_id = ?`).get(userId);
        const internalId = user ? user.id : userId;

        await db.prepare(
            'INSERT OR IGNORE INTO photo_message_views (user_id, message_id) VALUES (?, ?)'
        ).run(internalId, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark message as viewed' });
    }
});

// --- Chat Messages API ---

// 1. Get chat history for a specific student (used by both student and admin)
app.get('/api/chat/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(userId);
        const internalId = user ? user.id : userId;

        const messages = await db.prepare(`
            SELECT * FROM messages 
            WHERE (sender_id = ? AND receiver_id = 'admin') 
               OR (sender_id = 'admin' AND receiver_id = ?)
            ORDER BY created_at ASC
        `).all(internalId, internalId);
        res.json(messages);
    } catch (error) {
        console.error('Failed to fetch chat messages:', error);
        res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
});

// 2. Send a new message
app.post('/api/chat', async (req, res) => {
    try {
        const { sender_id, receiver_id, text } = req.body;
        if (!sender_id || !receiver_id || !text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let actualSenderId = sender_id;
        if (sender_id !== 'admin') {
            const sender = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(sender_id);
            if (sender) actualSenderId = sender.id;
        }

        let actualReceiverId = receiver_id;
        if (receiver_id !== 'admin') {
            const receiver = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(receiver_id);
            if (receiver) actualReceiverId = receiver.id;
        }

        const result = await db.prepare(`
            INSERT INTO messages (sender_id, receiver_id, text) 
            VALUES (?, ?, ?)
        `).run(actualSenderId, actualReceiverId, text);

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// 3. Get admin conversations list (list of students who have chatted)
app.get('/api/chat/admin/conversations', async (req, res) => {
    try {
        // Group by user, get the last message time and count unread from them
        const conversations = await db.prepare(`
            SELECT 
                t.user_id,
                MAX(t.created_at) as last_activity,
                SUM(CASE WHEN t.sender_id != 'admin' AND t.is_read = 0 THEN 1 ELSE 0 END) as unread_count,
                (SELECT text FROM messages m2 
                 WHERE (m2.sender_id = t.user_id AND m2.receiver_id = 'admin') 
                    OR (m2.sender_id = 'admin' AND m2.receiver_id = t.user_id) 
                 ORDER BY created_at DESC LIMIT 1) as last_message
            FROM (
                SELECT 
                    *,
                    CASE 
                        WHEN sender_id = 'admin' THEN receiver_id 
                        ELSE sender_id 
                    END as user_id
                FROM messages
                WHERE sender_id = 'admin' OR receiver_id = 'admin'
            ) t
            GROUP BY t.user_id
            ORDER BY last_activity DESC
        `).all();

        res.json(conversations);
    } catch (error) {
        console.error('Failed to fetch conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// 4. Mark messages as read
app.post('/api/chat/read', async (req, res) => {
    try {
        const { sender_id, receiver_id } = req.body;

        let actualSenderId = sender_id;
        if (sender_id !== 'admin') {
            const sender = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(sender_id);
            if (sender) actualSenderId = sender.id;
        }

        let actualReceiverId = receiver_id;
        if (receiver_id !== 'admin') {
            const receiver = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(receiver_id);
            if (receiver) actualReceiverId = receiver.id;
        }

        await db.prepare(`
            UPDATE messages 
            SET is_read = 1 
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
        `).run(actualSenderId, actualReceiverId);

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to mark as read:', error);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// --- Admin: Levels (Courses) API ---

// --- Homework Submissions API ---

// Student submits homework (text + optional file)
app.post('/api/homework', upload.single('file'), async (req, res) => {
    try {
        const { lesson_id, user_id, text } = req.body;
        if (!lesson_id || !user_id) return res.status(400).json({ error: 'lesson_id and user_id required' });

        const user = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(user_id);
        const internalId = user ? user.id : user_id;

        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const fileName = req.file ? req.file.originalname : null;

        const result = await db.prepare(
            'INSERT INTO homework_submissions (lesson_id, user_id, text, file_url, file_name) VALUES (?, ?, ?, ?, ?)'
        ).run(lesson_id, internalId, text || '', fileUrl, fileName);

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Failed to submit homework:', error);
        res.status(500).json({ error: 'Failed to submit homework' });
    }
});

// Admin: get all homework for a lesson
app.get('/api/homework/lesson/:lessonId', async (req, res) => {
    try {
        const submissions = await db.prepare(
            'SELECT * FROM homework_submissions WHERE lesson_id = ? ORDER BY submitted_at DESC'
        ).all(req.params.lessonId);
        res.json(submissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch homework' });
    }
});

// Student: get their own homework submission for a lesson
app.get('/api/homework/lesson/:lessonId/user/:userId', async (req, res) => {
    try {
        const user = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(req.params.userId);
        const internalId = user ? user.id : req.params.userId;

        const submission = await db.prepare(
            'SELECT * FROM homework_submissions WHERE lesson_id = ? AND user_id = ? ORDER BY submitted_at DESC LIMIT 1'
        ).get(req.params.lessonId, internalId);
        res.json(submission || null);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch homework' });
    }
});



// Admin: get all pending or graded homework across all courses
app.get('/api/admin/homework', async (req, res) => {
    try {
        const { status } = req.query; // 'pending' or 'graded'
        let query = `
            SELECT h.*, l.title as lesson_title, u.first_name, u.last_name, u.username
            FROM homework_submissions h
            JOIN lessons l ON h.lesson_id = l.id
            JOIN users u ON h.user_id = u.id
        `;
        let params: any[] = [];

        if (status) {
            query += ` WHERE h.status = ?`;
            params.push(status);
        }
        query += ` ORDER BY h.submitted_at DESC`;

        const submissions = await db.prepare(query).all(...params);
        res.json(submissions);
    } catch (error) {
        console.error('Failed to fetch admin homework:', error);
        res.status(500).json({ error: 'Failed to fetch homework' });
    }
});

// Admin: Review and Grade a submission
app.post('/api/admin/homework/:id/grade', async (req, res) => {
    try {
        const { grade, feedback } = req.body;
        const id = req.params.id;

        await db.prepare(
            'UPDATE homework_submissions SET grade = ?, feedback = ?, status = ? WHERE id = ?'
        ).run(grade !== undefined ? grade : null, feedback || '', 'graded', id);

        // Optional: you could notify the student here via bot or message

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to grade homework:', error);
        res.status(500).json({ error: 'Failed to grade homework' });
    }
});

// Admin: General Dashboard Statistics
app.get('/api/admin/statistics', async (req, res) => {
    try {
        const stats = {
            totalUsers: (await db.prepare('SELECT COUNT(*) as c FROM users WHERE role != ?').get('admin'))?.c || 0,
            completedLessons: (await db.prepare('SELECT COUNT(*) as c FROM user_progress WHERE status = ?').get('completed'))?.c || 0,
            pendingHomework: (await db.prepare('SELECT COUNT(*) as c FROM homework_submissions WHERE status = ?').get('pending'))?.c || 0,
            activeToday: (await db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM user_progress WHERE date(completed_at) = date("now")').get())?.c || 0
        };
        res.json(stats);
    } catch (error) {
        console.error('Failed to fetch admin stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get all courses
app.get('/api/levels', async (_req, res) => {
    try {
        const levels = await db.prepare('SELECT l.*, COUNT(ls.id) as lesson_count FROM levels l LEFT JOIN lessons ls ON ls.level_id = l.id GROUP BY l.id ORDER BY l."order" ASC').all();
        res.json(levels);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch levels' });
    }
});

// Create a new course
app.post('/api/levels', async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });
        const maxOrder = await db.prepare('SELECT MAX("order") as max FROM levels').get();
        const newOrder = Number(maxOrder?.max ?? 0) + 1;
        const result = await db.prepare('INSERT INTO levels (title, description, "order") VALUES (?, ?, ?)').run(title, description || '', newOrder);
        const created = await db.prepare('SELECT * FROM levels WHERE id = ?').get(result.lastInsertRowid);
        res.json(created);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create level' });
    }
});

// Delete a course
app.delete('/api/levels/:id', async (req, res) => {
    try {
        await db.prepare('DELETE FROM levels WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete level' });
    }
});

// --- Admin: Lessons API ---

// Get lessons in a level
app.get('/api/levels/:id/lessons', async (req, res) => {
    try {
        const lessons = await db.prepare('SELECT * FROM lessons WHERE level_id = ? ORDER BY "order" ASC').all(req.params.id);
        res.json(lessons);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lessons' });
    }
});

// Create a lesson in a level
app.post('/api/levels/:id/lessons', async (req, res) => {
    try {
        const { title } = req.body;
        const levelId = req.params.id;
        if (!title) return res.status(400).json({ error: 'Title is required' });
        const maxOrder = await db.prepare('SELECT MAX("order") as max FROM lessons WHERE level_id = ?').get(levelId);
        const newOrder = Number(maxOrder?.max ?? 0) + 1;
        const result = await db.prepare('INSERT INTO lessons (level_id, title, "order") VALUES (?, ?, ?)').run(levelId, title, newOrder);
        const created = await db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid);
        res.json(created);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create lesson' });
    }
});

// Delete a lesson
app.delete('/api/lessons/:id', async (req, res) => {
    try {
        await db.prepare('DELETE FROM lesson_blocks WHERE lesson_id = ?').run(req.params.id);
        await db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete lesson' });
    }
});

// --- Admin: Lesson Blocks API ---

// Get all blocks for a lesson
app.get('/api/lessons/:id/blocks', async (req, res) => {
    try {
        const blocks = await db.prepare('SELECT * FROM lesson_blocks WHERE lesson_id = ? ORDER BY "order" ASC').all(req.params.id);
        const parsed = blocks.map((b: any) => ({ ...b, content: JSON.parse(b.content) }));
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lesson blocks' });
    }
});

// Save (replace) all blocks for a lesson
app.post('/api/lessons/:id/blocks', async (req, res) => {
    try {
        const lessonId = req.params.id;
        const { blocks } = req.body;
        if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks must be an array' });

        // Clear and reinsert
        await db.prepare('DELETE FROM lesson_blocks WHERE lesson_id = ?').run(lessonId);
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            await db.prepare('INSERT INTO lesson_blocks (lesson_id, type, content, "order") VALUES (?, ?, ?, ?)').run(lessonId, b.type, JSON.stringify(b.content), i);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save blocks' });
    }
});

// Update lesson title
app.patch('/api/lessons/:id', async (req, res) => {
    try {
        const { title } = req.body;
        await db.prepare('UPDATE lessons SET title = ? WHERE id = ?').run(title, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update lesson' });
    }
});

// --- Flashcards / Dictionary API ---

// Admin: Get flashcards for a specific lesson
app.get('/api/admin/lessons/:lessonId/flashcards', async (req, res) => {
    try {
        const flashcards = await db.prepare('SELECT id, word as front, translation as back FROM flashcards WHERE lesson_id = ? ORDER BY id').all(req.params.lessonId);
        res.json(flashcards);
    } catch (err) {
        console.error("Failed to fetch flashcards", err);
        res.status(500).json({ error: 'Failed to fetch flashcards' });
    }
});

// Admin: Save (replace) entire flashcard list for a lesson
app.post('/api/admin/lessons/:lessonId/flashcards', async (req, res) => {
    try {
        const lessonId = req.params.lessonId;
        const flashcards: { id?: number; front: string; back: string }[] = req.body;

        // Remove all old flashcards for this lesson
        await db.prepare('DELETE FROM flashcards WHERE lesson_id = ?').run(lessonId);

        // Insert new ones
        for (const fc of flashcards) {
            if (fc.front.trim() && fc.back.trim()) {
                await db.prepare('INSERT INTO flashcards (lesson_id, word, translation) VALUES (?, ?, ?)').run(lessonId, fc.front.trim(), fc.back.trim());
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Failed to save flashcards", err);
        res.status(500).json({ error: 'Failed to save flashcards' });
    }
});

// Student: Get their personal dictionary with SRS stats
app.get('/api/users/:userId/dictionary', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(userId);
        const internalId = user ? user.id : userId;

        const dictionary = await db.prepare(`
            SELECT f.id, f.word as front, f.translation as back, l.title as lesson_title,
                   COALESCE(ufp.times_shown, 0) as times_shown,
                   COALESCE(ufp.times_correct, 0) as times_correct,
                   COALESCE(ufp.times_wrong, 0) as times_wrong
            FROM flashcards f
            JOIN lessons l ON f.lesson_id = l.id
            JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ?
            LEFT JOIN user_flashcard_progress ufp ON ufp.flashcard_id = f.id AND ufp.user_id = ?
            WHERE up.status IN ('completed', 'unlocked')
            ORDER BY l."order", f.id
        `).all(internalId, userId);
        res.json(dictionary);
    } catch (err) {
        console.error("Failed to fetch dictionary", err);
        res.status(500).json({ error: 'Failed to fetch dictionary' });
    }
});

// Student: Get flashcards due for study (SRS-prioritized)
app.get('/api/users/:userId/flashcards/study', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(userId);
        const internalId = user ? user.id : userId;

        // Get all available flashcards, prioritizing: 1) never-seen cards, 2) cards due for review
        const cards = await db.prepare(`
            SELECT f.id, f.word as front, f.translation as back, l.title as lesson_title,
                   COALESCE(ufp.times_shown, 0) as times_shown,
                   COALESCE(ufp.times_correct, 0) as times_correct,
                   COALESCE(ufp.times_wrong, 0) as times_wrong,
                   ufp.next_review_at
            FROM flashcards f
            JOIN lessons l ON f.lesson_id = l.id
            JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ?
            LEFT JOIN user_flashcard_progress ufp ON ufp.flashcard_id = f.id AND ufp.user_id = ?
            WHERE up.status IN ('completed', 'unlocked')
            ORDER BY
                CASE
                    WHEN ufp.times_shown IS NULL OR ufp.times_shown = 0 THEN 0
                    WHEN ufp.next_review_at IS NULL OR ufp.next_review_at <= datetime('now') THEN 1
                    ELSE 2
                END,
                ufp.next_review_at ASC
            LIMIT 20
        `).all(internalId, userId);
        res.json(cards);
    } catch (err) {
        console.error("Failed to fetch study cards", err);
        res.status(500).json({ error: 'Failed to fetch study cards' });
    }
});

// Student: Submit review result for a flashcard (Anki SM-2 algorithm)
app.post('/api/users/:userId/flashcards/:flashcardId/review', async (req, res) => {
    try {
        const { userId, flashcardId } = req.params;
        const { correct } = req.body; // boolean

        // Get existing progress
        const existing = await db.prepare(
            'SELECT * FROM user_flashcard_progress WHERE user_id = ? AND flashcard_id = ?'
        ).get(userId, flashcardId) as any;

        let timesShown = (existing?.times_shown || 0) + 1;
        let timesCorrect = (existing?.times_correct || 0) + (correct ? 1 : 0);
        let timesWrong = (existing?.times_wrong || 0) + (correct ? 0 : 1);
        let easeFactor = existing?.ease_factor || 2.5;
        let intervalDays = existing?.interval_days || 0;

        if (correct) {
            // SM-2: increase interval
            if (intervalDays === 0) {
                intervalDays = 1;
            } else if (intervalDays === 1) {
                intervalDays = 3;
            } else {
                intervalDays = Math.round(intervalDays * easeFactor);
            }
            easeFactor = Math.max(1.3, easeFactor + 0.1);
        } else {
            // Wrong: reset interval, decrease ease
            intervalDays = 0; // Show again soon (within this session)
            easeFactor = Math.max(1.3, easeFactor - 0.2);
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + intervalDays);
        const nextReviewAt = nextReview.toISOString().replace('T', ' ').split('.')[0];

        await db.prepare(`
            INSERT INTO user_flashcard_progress (user_id, flashcard_id, times_shown, times_correct, times_wrong, ease_factor, interval_days, next_review_at, last_reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, flashcard_id) DO UPDATE SET
                times_shown = excluded.times_shown,
                times_correct = excluded.times_correct,
                times_wrong = excluded.times_wrong,
                ease_factor = excluded.ease_factor,
                interval_days = excluded.interval_days,
                next_review_at = excluded.next_review_at,
                last_reviewed_at = excluded.last_reviewed_at
        `).run(userId, flashcardId, timesShown, timesCorrect, timesWrong, easeFactor, intervalDays, nextReviewAt);

        res.json({ success: true, intervalDays, nextReviewAt });
    } catch (err) {
        console.error("Failed to record review", err);
        res.status(500).json({ error: 'Failed to record review' });
    }
});

// Student: Get overall stats for profile & tasks page
app.get('/api/users/:userId/stats', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(userId);
        const internalId = user ? user.id : userId;

        // Lessons stats
        const lessonsCompleted = ((await db.prepare(
            `SELECT COUNT(*) as count FROM user_progress WHERE user_id = ? AND status = 'completed'`
        ).get(internalId)) as any)?.count || 0;

        const totalLessons = ((await db.prepare(
            `SELECT COUNT(*) as count FROM lessons`
        ).get()) as any)?.count || 0;

        // Flashcard stats from user_flashcard_progress
        const fcStats = (await db.prepare(
            `SELECT COUNT(*) as sessions, SUM(times_shown) as totalReviews,
                    SUM(times_correct) as totalCorrect, SUM(times_wrong) as totalWrong
             FROM user_flashcard_progress WHERE user_id = ?`
        ).get(userId)) as any || {};

        const flashcardSessions = fcStats.sessions || 0;
        const totalReviews = fcStats.totalReviews || 0;

        // Estimate flashcard time: ~10 seconds per review
        const fcMinutes = Math.round((totalReviews * 10) / 60);
        const flashcardTime = fcMinutes < 60 ? `${fcMinutes} хв` : `${Math.floor(fcMinutes / 60)} год ${fcMinutes % 60} хв`;

        // Total time = lessons completed * ~5 min + flashcard time
        const totalMinutes = (lessonsCompleted * 5) + fcMinutes;
        const totalTime = totalMinutes < 60 ? `${totalMinutes} хв` : `${Math.floor(totalMinutes / 60)} год ${totalMinutes % 60} хв`;

        // Streak: count consecutive days with activity (completed lessons or flashcard reviews)
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const lessonActivity = ((await db.prepare(
                `SELECT COUNT(*) as count FROM user_progress 
                 WHERE user_id = ? AND status = 'completed' AND date(completed_at) = ?`
            ).get(internalId, dateStr)) as any)?.count || 0;

            const fcActivity = ((await db.prepare(
                `SELECT COUNT(*) as count FROM user_flashcard_progress 
                 WHERE user_id = ? AND date(last_reviewed_at) = ?`
            ).get(userId, dateStr)) as any)?.count || 0;

            if (lessonActivity > 0 || fcActivity > 0) {
                streak++;
            } else if (i > 0) { // skip today if no activity yet
                break;
            }
        }

        // Week activity (Mon-Sun scores for the chart)
        const weekActivity: number[] = [];
        const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek);

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];

            const completedCount = ((await db.prepare(
                `SELECT COUNT(*) as count FROM user_progress 
                 WHERE user_id = ? AND status = 'completed' AND date(completed_at) = ?`
            ).get(internalId, dateStr)) as any)?.count || 0;

            const fcCount = ((await db.prepare(
                `SELECT COUNT(*) as count FROM user_flashcard_progress 
                 WHERE user_id = ? AND date(last_reviewed_at) = ?`
            ).get(userId, dateStr)) as any)?.count || 0;

            // Score: each lesson = 5 points, each fc review = 1 point, max 10
            weekActivity.push(Math.min(10, completedCount * 5 + fcCount));
        }

        res.json({
            streak,
            totalTime,
            lessonsCompleted,
            totalLessons,
            flashcardSessions,
            flashcardTime,
            weekActivity,
        });
    } catch (err) {
        console.error("Failed to fetch stats", err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// --- Catch-all route for React SPA ---
// Must be after all /api and /uploads routes
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return res.status(404).json({ error: 'Not found' });
    }

    const distIndex = resolve(__dirname, '../dist/index.html');
    if (existsSync(distIndex)) {
        res.sendFile(distIndex);
    } else {
        res.status(503).send('Frontend build not found. Please run "npm run build" first.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

