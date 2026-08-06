// Walks the teacher's path through the sandbox: open the panel, edit a lesson
// with the formatting toolbar, set a mascot mood, generate vocabulary, save,
// then manage students and grade the homework the student flow submitted.
//
//   node scripts/flow-admin.mjs
//
// Expects the server running against sandbox/sandbox.sqlite. Run the student
// flow first if you want homework waiting to be graded.

import { launch } from './drive.mjs';
import path from 'path';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || path.resolve(import.meta.dirname, '..', 'sandbox', 'shots', 'admin');

let step = 0;
const results = [];
const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`  ${ok ? 'OK  ' : 'ЗБІЙ'} ${name}${detail ? '  — ' + detail : ''}`);
};

const main = async () => {
    const b = await launch({ profile: path.join(OUT, '.profile'), port: 9223 });
    // olia16 is on the admin list, so this is the real production path to the panel.
    await b.asTelegramUser({ id: 404163431, first_name: 'Ольга', username: 'olia16' });

    const shot = async (name) => b.shot(path.join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`));

    console.log('\n=== ФЛОУ ВИКЛАДАЧА ===');

    await b.goto(`${BASE}/profile`, 2500);
    let text = await b.text();
    check('викладач бачить кнопку адмінки', text.includes('Панель адміністратора'));

    await b.goto(`${BASE}/admin`, 2500);
    text = await b.text();
    await shot('panel');
    check('кабінет відкрився', text.includes('Кабінет викладача'));
    check('є плитка учнів', text.includes('Учні'));

    await b.goto(`${BASE}/admin/lesson/1`, 3000);
    text = await b.text();
    await shot('editor');
    check('конструктор відкрився', text.includes('Конструктор уроку'));
    check('панель форматування є', text.includes('Список') && text.includes('Очистити'));
    check('блок маскота видно', text.includes('Маскот-підказка'));
    check('передпоказ маскота', text.includes('ЯК ЦЕ ПОБАЧИТЬ УЧЕНЬ'));

    // Formatting: select text that is not already bold - the button toggles, so
    // selecting the bold heading would correctly turn it off instead.
    const boldApplied = await b.evaluate(`(() => {
        const ed = document.querySelector('.rich-editor');
        if (!ed) return 'редактора немає';
        const target = [...ed.querySelectorAll('p')].find(p => !p.querySelector('strong, b') && p.innerText.trim());
        if (!target) return 'не знайшов звичайного абзацу';
        const plainBefore = target.innerHTML;
        ed.focus();
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
        const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Ж');
        if (!btn) return 'кнопки Ж немає';
        btn.click();
        return JSON.stringify({ before: plainBefore.slice(0, 40), after: target.innerHTML.slice(0, 70) });
    })()`);
    check('кнопка «Ж» вмикає жирний', /<(b|strong)\b/i.test(String(boldApplied)), String(boldApplied).slice(0, 90));

    // Paste from a rich source must arrive cleaned, not as raw markup.
    const pasteClean = await b.evaluate(`(() => {
        const ed = document.querySelector('.rich-editor');
        if (!ed) return 'редактора немає';
        ed.focus();
        const dt = new DataTransfer();
        dt.setData('text/html', '<p style="color:red" onclick="x()">Вставлено <b>жирним</b></p><script>alert(1)<\\/script>');
        dt.setData('text/plain', 'Вставлено жирним');
        ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        return ed.innerHTML;
    })()`);
    const html = String(pasteClean);
    check('вставка чиститься', !/onclick|style=|<script/i.test(html) && /жирним/.test(html), html.slice(0, 70));

    // Mood picker.
    const moodSet = await b.evaluate(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Здивований');
        if (!btn) return false;
        btn.click();
        return true;
    })()`);
    await b.wait(600);
    await shot('mood-picked');
    check('настрій маскота перемикається', moodSet);

    // Vocabulary generation.
    const before = await b.evaluate(`document.querySelectorAll('input[placeholder="Слово (en)"]').length`);
    await b.clickText('Згенерувати слова з уроку');
    await b.wait(14000);
    const after = await b.evaluate(`document.querySelectorAll('input[placeholder="Слово (en)"]').length`);
    await shot('vocabulary');
    const genError = await b.evaluate(`(document.body.innerText.match(/Не вдалося[^\\n]*|Модель[^\\n]*|Генератор не налаштований[^\\n]*/) || [''])[0]`);
    check('ШІ додав слова', after > before, `було ${before}, стало ${after}${genError ? ' | ' + genError : ''}`);

    await b.clickText('Зберегти урок');
    await b.wait(3000);
    await shot('saved');
    check('урок збережено', true, 'натиснуто «Зберегти урок»');

    // Reload and confirm what was saved actually persisted.
    await b.goto(`${BASE}/admin/lesson/1`, 3500);
    const persisted = await b.evaluate(`(() => {
        const ed = document.querySelector('.rich-editor');
        const words = document.querySelectorAll('input[placeholder="Слово (en)"]').length;
        return JSON.stringify({ bold: /<(b|strong)\\b/i.test(ed ? ed.innerHTML : ''), words });
    })()`);
    const p = JSON.parse(persisted);
    check('форматування пережило перезавантаження', p.bold);
    check('слова збереглися', p.words > before, `${p.words} слів`);

    await b.goto(`${BASE}/admin/students`, 3000);
    text = await b.text();
    await shot('students');
    check('сторінка учнів відкрилась', text.includes('Учні'));
    check('видно заблокованих', text.includes('Заблоковані'));

    // Blocking moves the student to the other tab, so they leave this list -
    // the proof is on the Заблоковані tab, not this one.
    const activeBefore = await b.evaluate(`(document.body.innerText.match(/Активні \\((\\d+)\\)/) || [,'?'])[1]`);
    const blocked = await b.clickText('Заблокувати');
    await b.wait(2000);
    const activeAfter = await b.evaluate(`(document.body.innerText.match(/Активні \\((\\d+)\\)/) || [,'?'])[1]`);
    check('блокування зменшило список активних', blocked && Number(activeAfter) === Number(activeBefore) - 1, `${activeBefore} -> ${activeAfter}`);

    await b.clickText('Заблоковані');
    await b.wait(1200);
    await shot('after-block');
    const onBlockedTab = await b.text();
    check('учень зʼявився серед заблокованих', onBlockedTab.includes('Доступ обмежено') && onBlockedTab.includes('Розблокувати'));

    await b.clickText('Розблокувати');
    await b.wait(2000);
    const unblocked = await b.evaluate(`(document.body.innerText.match(/Активні \\((\\d+)\\)/) || [,'?'])[1]`);
    check('розблокування повертає учня', Number(unblocked) === Number(activeBefore), `активних знову ${unblocked}`);

    await b.goto(`${BASE}/admin/homework`, 3000);
    text = await b.text();
    await shot('homework-review');
    check('перевірка ДЗ відкрилась', /дз|домашн/i.test(text));
    check('здане ДЗ учня видно', text.includes('Yesterday I went to the gym') || text.includes('Тест'), 'із флоу учня');

    await b.close();

    const failed = results.filter(r => !r.ok);
    console.log(`\nперевірок: ${results.length}, збоїв: ${failed.length}`);
    console.log(`знімки: ${OUT}`);
    process.exit(failed.length ? 1 : 0);
};

main().catch(e => { console.error('впало:', e.message); process.exit(1); });
