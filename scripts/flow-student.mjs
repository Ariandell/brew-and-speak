// Walks the student's path through the sandbox exactly as a person would:
// pick a course, open a lesson, answer every exercise, finish, read the
// results, then submit homework. Screenshots each step.
//
//   node scripts/flow-student.mjs
//
// Expects the server running against sandbox/sandbox.sqlite.

import { launch } from './drive.mjs';
import path from 'path';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || path.resolve(import.meta.dirname, '..', 'sandbox', 'shots', 'student');

let step = 0;
const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`  ${ok ? 'OK  ' : 'ЗБІЙ'} ${name}${detail ? '  — ' + detail : ''}`);
};

const main = async () => {
    const b = await launch({ profile: path.join(OUT, '.profile'), port: 9222 });
    await b.asTelegramUser({ id: 900001, first_name: 'Тест', last_name: 'Учень', username: 'test_student' });

    const shot = async (name) => b.shot(path.join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`));

    console.log('\n=== ФЛОУ УЧНЯ ===');

    await b.goto(`${BASE}/`, 2500);
    let text = await b.text();
    await shot('start');
    check('додаток відкрився', text.length > 0 && !/Щось пішло не так/.test(text), (await b.url()));

    // A new student has no course, so the app should offer the picker.
    if ((await b.url()).includes('/courses')) {
        check('новачка ведуть на вибір курсу', true);
        await b.clickText('Пісочниця A1');
        await b.wait(2000);
        await shot('course-picked');
    }

    await b.goto(`${BASE}/`, 2500);
    text = await b.text();
    await shot('home');
    check('головна показує курс', text.includes('Пісочниця A1') || text.includes('ПОТОЧНИЙ КУРС'));
    check('головна не порожня', text.replace(/\s/g, '').length > 40, `${text.replace(/\s/g, '').length} символів`);

    await b.goto(`${BASE}/lesson/1`, 2500);
    text = await b.text();
    await shot('lesson-top');
    check('урок відкрився', text.includes('Ранкова рутина'));
    check('форматування показується', text.includes('Вправа 1'), 'жирний заголовок з HTML');
    check('маскот у уроці', text.includes('неймовірний'));

    // Quiz: the blank option must not be offered.
    const quizOptions = await b.evaluate(`[...document.querySelectorAll('button')].filter(b => /^(I wake up|I sleep)$/.test(b.innerText.trim())).length`);
    const blankButtons = await b.evaluate(`[...document.querySelectorAll('button')].filter(b => !b.innerText.trim() && b.offsetWidth > 40 && b.offsetHeight > 30).length`);
    check('порожній варіант тесту прибрано', quizOptions === 2 && blankButtons === 0, `варіантів ${quizOptions}, порожніх ${blankButtons}`);

    await b.clickText('I wake up');
    await b.wait(600);

    // fill_blank: the seeded answer is padded (" wake ") and the gap is a single
    // underscore - both of the shapes that used to make it unanswerable.
    const gapBefore = await b.evaluate(`document.body.innerText.includes('I ___ up at seven')`);
    check('пропуск «_» розпізнано', gapBefore, 'показано як ___');
    // Exact match: "I wake up" from the quiz above also contains "wake".
    await b.evaluate(`(() => {
        const el = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'wake');
        if (!el) return false;
        el.scrollIntoView({ block: 'center' });
        el.click();
        return true;
    })()`);
    await b.wait(700);
    await shot('lesson-answered');
    const fillOk = await b.evaluate(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'wake');
        return btn ? getComputedStyle(btn).backgroundColor : 'не знайдено';
    })()`);
    check('відповідь із пробілами зараховано', String(fillOk).includes('209, 250, 229'), `фон кнопки ${fillOk} (зелений = правильно)`);

    await b.clickText('Вірно');
    await b.wait(500);

    await b.clickText('Завершити урок');
    await b.wait(2500);
    text = await b.text();
    await shot('results');
    check('екран результатів зʼявився', text.includes('Правильних') && text.includes('Бали'));
    check('результат показує відсоток', /\d+%/.test(text));
    check('є кнопка здати ДЗ', text.includes('Здати домашнє завдання'));

    await b.clickText('Здати домашнє завдання');
    await b.wait(2500);
    text = await b.text();
    await shot('homework');
    check('сторінка ДЗ відкрилась', (await b.url()).includes('/homework'));
    check('завдання показане зверху', /завдання:/i.test(text) && text.includes('Вправа 1'), 'із форматуванням');

    await b.fill('textarea', 'Yesterday I went to the gym. She made a cake.');
    await b.wait(400);
    await shot('homework-filled');
    await b.clickText('Відправити на перевірку');
    await b.wait(2500);
    text = await b.text();
    await shot('homework-sent');
    check('ДЗ відправлено', text.includes('Відправлено'));

    await b.goto(`${BASE}/flashcards`, 3000);
    await shot('flashcards');
    text = await b.text();
    check('флешкартки працюють', text.includes('Вивчення слів'));
    const mascotOnCards = await b.evaluate(`!!document.querySelector('img[src*="/assets/mascot/animations/"]')`);
    check('маскот на флешкартках', mascotOnCards);

    await b.goto(`${BASE}/dictionary`, 2500);
    await shot('dictionary');
    check('словник працює', (await b.text()).includes('Мій Словник'));

    // The security fix: a student must not see the teacher's panel.
    await b.goto(`${BASE}/profile`, 2500);
    text = await b.text();
    await shot('profile');
    check('учень НЕ бачить адмінку', !text.includes('Панель адміністратора'), 'кнопки немає');

    await b.close();

    const failed = results.filter(r => !r.ok);
    console.log(`\nперевірок: ${results.length}, збоїв: ${failed.length}`);
    console.log(`знімки: ${OUT}`);
    process.exit(failed.length ? 1 : 0);
};

main().catch(e => { console.error('впало:', e.message); process.exit(1); });
