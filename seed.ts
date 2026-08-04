import { db } from './server/db.js';

async function seed() {
    console.log('Seeding data...');
    try {
        await db.prepare('INSERT INTO levels (title, description, "order") VALUES (?, ?, ?)').run('Основи', 'Перші кроки в англійській', 1);
        await db.prepare('INSERT INTO levels (title, description, "order") VALUES (?, ?, ?)').run('Місто', 'Орієнтуємось в місті', 2);

        const level1Res = await db.prepare('SELECT id FROM levels WHERE "order" = 1').get();
        const level1 = level1Res.id;

        const level2Res = await db.prepare('SELECT id FROM levels WHERE "order" = 2').get();
        const level2 = level2Res.id;

        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level1, 'Привітання', 'cafe', 1);
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level1, 'Ранкова кава', 'cafe', 2);
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level1, 'Сніданок', 'sweet', 3);

        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level2, 'В аеропорті', 'city', 1);
        await db.prepare('INSERT INTO lessons (level_id, title, theme_background, "order") VALUES (?, ?, ?, ?)').run(level2, 'Метро', 'city', 2);

        const lesson1Res = await db.prepare('SELECT id FROM lessons WHERE title = "Привітання"').get();
        const lesson1 = lesson1Res.id;

        // Types the app can actually render. The seeder used to write 'grammar'
        // and 'exercise_click', which no version of the frontend has ever known
        // how to draw, so seeded lessons came out with blank cards in them.
        await db.prepare('INSERT INTO lesson_blocks (lesson_id, type, content, "order") VALUES (?, ?, ?, ?)').run(lesson1, 'text', JSON.stringify({ body: '<p><strong>Hello / Hi</strong></p><p>Кажемо Hello друзям!</p>' }), 1);
        await db.prepare('INSERT INTO lesson_blocks (lesson_id, type, content, "order") VALUES (?, ?, ?, ?)').run(lesson1, 'quiz', JSON.stringify({ question: 'Виберіть привітання', options: [{ label: 'Hello', isCorrect: true }, { label: 'Table', isCorrect: false }] }), 2);
        await db.prepare('INSERT INTO lesson_blocks (lesson_id, type, content, "order") VALUES (?, ?, ?, ?)').run(lesson1, 'mascot_tip', JSON.stringify({ text: 'Гарний початок!', mood: 'happy' }), 3);

        console.log('✅ Seed successful');
    } catch (e) {
        console.error('Seed failed:', e);
    }
}

seed();
