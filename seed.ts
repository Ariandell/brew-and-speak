import { db } from './server/db.js';

async function seed() {
    console.log('Seeding data...');
    try {
        // 1. Levels
        await db.prepare('INSERT INTO levels (title, description, "order") VALUES (?, ?, ?)').run('Основи', 'Перші кроки в англійській', 1);
        await db.prepare('INSERT INTO levels (title, description, "order") VALUES (?, ?, ?)').run('Місто', 'Орієнтуємось в місті', 2);

        // Get levels
        const level1Res = await db.prepare('SELECT id FROM levels WHERE "order" = 1').get();
        const level1 = level1Res.id;

        const level2Res = await db.prepare('SELECT id FROM levels WHERE "order" = 2').get();
        const level2 = level2Res.id;

        // 2. Lessons
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level1, 'Привітання', 'cafe', 1);
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level1, 'Ранкова кава', 'cafe', 2);
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level1, 'Сніданок', 'sweet', 3);

        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level2, 'В аеропорті', 'city', 1);
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level2, 'Метро', 'city', 2);

        // 3. Lesson Blocks
        const lesson1Res = await db.prepare('SELECT id FROM lessons WHERE title = "Привітання"').get();
        const lesson1 = lesson1Res.id;

        await db.prepare('INSERT INTO lesson_blocks (lesson_id, type, content, "order") VALUES (?, ?, ?, ?)').run(lesson1, 'grammar', JSON.stringify({ title: 'Hello / Hi', content: 'Кажемо Hello друзям!' }), 1);
        await db.prepare('INSERT INTO lesson_blocks (lesson_id, type, content, "order") VALUES (?, ?, ?, ?)').run(lesson1, 'exercise_click', JSON.stringify({ content: 'Виберіть привітання' }), 2);

        console.log('✅ Seed successful');
    } catch (e) {
        console.error('Seed failed:', e);
    }
}

seed();
