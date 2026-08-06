// The case the client hit: finish a lesson without answering anything.
// Skipping must not read as a perfect score.
import { launch } from './drive.mjs';
import path from 'path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve(import.meta.dirname, '..', 'sandbox', 'shots', 'skip');

const main = async () => {
    const b = await launch({ profile: path.join(OUT, '.profile'), port: 9224 });
    await b.asTelegramUser({ id: 900777, first_name: 'Пропускач', username: 'skipper' });

    await b.goto(`${BASE}/courses`, 2500);
    await b.clickText('Пісочниця A1');
    await b.wait(2000);

    await b.goto(`${BASE}/lesson/1`, 2500);
    console.log('  відкрив урок і НЕ торкнувся жодної вправи');
    await b.clickText('Завершити урок');
    await b.wait(2500);

    const text = await b.text();
    await b.shot(path.join(OUT, 'skipped-results.png'));
    const pct = (text.match(/(\d+)%/) || [, '?'])[1];
    const correct = (text.match(/Правильних\s*(\d+)\/(\d+)/) || [])[0] || '—';
    const skipped = (text.match(/Пропущено\s*(\d+)\/(\d+)/) || [])[0] || 'не показано';

    console.log('  відсоток:   ' + pct + '%');
    console.log('  ' + correct);
    console.log('  ' + skipped);
    console.log('  вердикт:    ' + (text.split('\n').find(l => /Бездоганно|Не здавайся|Гарна робота|не виконані|пройдено/.test(l)) || '?').trim());

    const ok = pct === '0' && !text.includes('Бездоганно');
    console.log('\n  ' + (ok ? 'OK — пропуск більше не дає 100%' : 'ЗБІЙ — пропуск усе ще зараховується'));
    await b.close();
    process.exit(ok ? 0 : 1);
};
main().catch(e => { console.error('впало:', e.message); process.exit(1); });
