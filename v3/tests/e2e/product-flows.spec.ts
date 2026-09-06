import { expect, test, type Page } from '@playwright/test';

let browserErrors: string[] = [];

test.beforeEach(async ({ page }) => {
    browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') browserErrors.push(message.text());
    });
});

test.afterEach(async () => {
    expect(browserErrors, 'browser console/page errors').toEqual([]);
});

const openFresh = async (page: Page, path = '/?demo=student#/welcome') => {
    await page.goto(path);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
};

const swipeFlashcard = async (page: Page, direction: 'left' | 'right') => {
    const card = page.getByRole('button', { name: /^Картка / });
    await card.click();
    const box = await card.boundingBox();
    if (!box) throw new Error('Flashcard is not visible');
    const startX = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + (direction === 'right' ? 125 : -125), y, { steps: 6 });
    await page.mouse.up();
};

test('new student chooses a course and reaches the finished home screen', async ({ page }) => {
    await openFresh(page, '/?demo=new-student#/welcome');
    await expect(page.getByRole('heading', { name: /English with Coffee/i })).toBeVisible();
    await page.getByRole('button', { name: /^Почати/ }).click();
    await expect(page.getByRole('heading', { name: 'Обери курс.' })).toBeVisible();
    await page.getByRole('button', { name: 'Обрати курс Intermediate English' }).click();
    await expect(page.getByRole('heading', { name: /ТВІЙ ДЕНЬ/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Продовжити урок/ })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Intermediate English')).toBeVisible();
});

test('locked deep link is blocked and an attempt survives refresh', async ({ page }) => {
    await openFresh(page, '/?demo=student#/lesson/2');
    await expect(page.getByText('Урок поки закритий')).toBeVisible();
    await page.goto('/?demo=student#/lesson/1');
    await page.getByRole('button', { name: 'I have finished my coffee.' }).click();
    await expect(page.getByText('1/5')).toBeVisible();
    await page.reload();
    await expect(page.getByText('1/5')).toBeVisible();
    await expect(page.getByText(/Правильно/)).toBeVisible();
});

test('skipping exercises never produces a perfect score and enables cooldown', async ({ page }) => {
    await openFresh(page, '/?demo=student#/lesson/1');
    await page.getByRole('button', { name: 'Завершити урок' }).click();
    await expect(page.getByText(/0\s*із 10/)).toBeVisible();
    await expect(page.getByText('5', { exact: true })).toBeVisible();
    await page.goto('/?demo=student#/lesson/1');
    await expect(page.getByText('Урок поки закритий')).toBeVisible();
    await expect(page.getByText(/Повторне проходження відкриється/)).toBeVisible();
});

test('all five exercise types produce an honest perfect score', async ({ page }) => {
    await openFresh(page, '/?demo=student#/lesson/1');
    await page.getByRole('button', { name: 'I have finished my coffee.' }).click();
    await page.getByRole('button', { name: 'has', exact: true }).click();
    await page.getByRole('button', { name: 'Хибно', exact: true }).click();
    for (const word of ['Have', 'you', 'ever', 'visited', 'London?']) await page.getByRole('button', { name: word, exact: true }).click();
    await page.getByRole('button', { name: 'Перевірити порядок' }).click();
    const pairs = page.locator('select');
    await pairs.nth(0).selectOption({ label: 'вже' });
    await pairs.nth(1).selectOption({ label: 'ще' });
    await pairs.nth(2).selectOption({ label: 'коли-небудь' });
    await page.getByRole('button', { name: 'Перевірити пари' }).click();
    await page.getByRole('button', { name: 'Завершити урок' }).click();
    await expect(page.getByText(/10\s*із 10/)).toBeVisible();
    await expect(page.getByText('Бездоганно.')).toBeVisible();
});

test('homework travels student → teacher → student without a duplicate', async ({ page }) => {
    await openFresh(page, '/?demo=student#/lesson/1/homework');
    const answer = 'I have finished the complete cross-role flow.';
    await page.getByRole('textbox', { name: 'Відповідь' }).fill(answer);
    await page.getByRole('button', { name: 'Надіслати на перевірку' }).click();
    await page.getByRole('button', { name: 'Оновити й надіслати' }).click();
    await page.goto('/?demo=teacher#/teacher/homework');
    await page.getByRole('button', { name: /Андрій Чекає Present Perfect/ }).click();
    await expect(page.getByText(answer)).toBeVisible();
    await page.getByRole('slider').fill('7');
    await page.getByRole('textbox', { name: 'Коментар' }).fill('Перевірено наскрізним сценарієм.');
    await page.getByRole('button', { name: 'Зберегти оцінку' }).click();
    await page.goto('/?demo=student#/lesson/1/homework');
    await expect(page.getByText('7/10')).toBeVisible();
    await expect(page.getByText('Перевірено наскрізним сценарієм.')).toBeVisible();
    await expect(page.getByText(answer)).toHaveCount(1);
});

test('homework strips pasted markup and rejects unsupported files', async ({ page }) => {
    await openFresh(page, '/?demo=student#/lesson/1/homework');
    const file = page.locator('input[type=file]');
    await file.setInputFiles({ name: 'payload.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('not executable') });
    await expect(page.getByRole('alert')).toContainText('не підтримується');
    await page.getByRole('textbox', { name: 'Відповідь' }).fill('<p>Hello</p><script>alert(1)</script>');
    await page.getByRole('button', { name: 'Надіслати на перевірку' }).click();
    await page.goto('/?demo=teacher#/teacher/homework');
    await page.getByRole('button', { name: /Андрій Чекає Present Perfect/ }).click();
    await expect(page.getByText('Hello', { exact: true })).toBeVisible();
    await expect(page.getByText(/script|alert\(1\)/)).toHaveCount(0);
});

test('chat is shared only with the intended student', async ({ page }) => {
    await openFresh(page, '/?demo=student#/chat');
    await page.getByRole('textbox', { name: 'Повідомлення' }).fill('Unique student message 4821');
    await page.getByRole('button', { name: 'Надіслати' }).click();
    await page.goto('/?demo=teacher#/teacher/chat');
    await page.getByRole('button', { name: /Андрій/ }).click();
    await expect(page.getByText('Unique student message 4821')).toBeVisible();
    await page.getByRole('textbox', { name: 'Повідомлення' }).fill('Teacher reply 4821');
    await page.getByRole('button', { name: 'Надіслати' }).click();
    await page.goto('/?demo=student-b#/chat');
    await expect(page.getByText('Teacher reply 4821')).toHaveCount(0);
    await page.goto('/?demo=student#/chat');
    await expect(page.getByText('Teacher reply 4821')).toBeVisible();
});

test('lesson progress and attempts are isolated between students', async ({ page }) => {
    await openFresh(page, '/?demo=student#/lesson/1');
    await page.getByRole('button', { name: 'I have finished my coffee.' }).click();
    await page.getByRole('button', { name: 'Завершити урок' }).click();
    await page.goto('/?demo=student-b#/lesson/1');
    await expect(page.getByRole('heading', { name: 'Present Perfect', exact: true })).toBeVisible();
    await expect(page.getByText('0/5')).toBeVisible();
    await expect(page.getByText('Урок поки закритий')).toHaveCount(0);
});

test('teacher editor refuses an unanswerable exercise', async ({ page }) => {
    await openFresh(page, '/?demo=teacher#/teacher/lessons/1');
    const correct = page.getByRole('textbox', { name: 'Правильна відповідь' }).first();
    await correct.fill('not-an-option');
    await page.getByRole('button', { name: /Зберегти 8 блоків/ }).click();
    await expect(page.getByText(/Правильна відповідь має бути серед варіантів/)).toBeVisible();
    await page.reload();
    await expect(correct).toHaveValue('I have finished my coffee.');
});

test('role guard and server-style block state are visible in the UI', async ({ page }) => {
    await openFresh(page, '/?demo=student#/teacher');
    await expect(page.getByRole('heading', { name: 'Недостатньо прав.' })).toBeVisible();
    await page.goto('/?demo=teacher#/teacher/students/101');
    await page.getByRole('button', { name: 'Заблокувати доступ' }).click();
    await page.goto('/?demo=student#/home');
    await expect(page.getByRole('heading', { name: 'Навчання поки закрите.' })).toBeVisible();
    await page.goto('/?demo=teacher#/teacher/students/101');
    await page.getByRole('button', { name: 'Відновити доступ' }).click();
});

test('course CRUD persists and refuses silent cascade deletion', async ({ page }) => {
    await openFresh(page, '/?demo=teacher#/teacher/courses');
    await page.getByRole('button', { name: 'Створити курс' }).click();
    await page.getByRole('textbox', { name: 'Назва' }).fill('Speaking Lab');
    await page.getByRole('textbox', { name: 'Опис' }).fill('Практичний курс.');
    await page.getByRole('textbox', { name: 'Рівень' }).fill('B2');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await page.reload();
    await expect(page.getByText('Speaking Lab')).toBeVisible();
    await page.getByRole('button', { name: 'Редагувати курс Intermediate English' }).click();
    await page.getByRole('button', { name: 'Видалити порожній курс' }).click();
    await expect(page.getByText(/Курс не видалено/)).toBeVisible();
    await expect(page.getByText('Intermediate English')).toBeVisible();
});

test('scheduled photo message appears only after its scheduled time', async ({ page }) => {
    await openFresh(page, '/?demo=teacher#/teacher/broadcasts');
    await page.locator('input[type=file]').setInputFiles({ name: 'coffee.png', mimeType: 'image/png', buffer: Buffer.from('png') });
    await page.getByRole('textbox', { name: 'Підпис' }).fill('Scheduled future card');
    await page.getByLabel('Дата й час').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await page.getByRole('button', { name: 'Запланувати розсилку' }).click();
    await page.goto('/?demo=student#/home');
    await expect(page.getByText('Scheduled future card')).toHaveCount(0);
    await page.goto('/?demo=teacher#/teacher/broadcasts');
    await page.locator('input[type=file]').setInputFiles({ name: 'coffee-now.png', mimeType: 'image/png', buffer: Buffer.from('png') });
    await page.getByRole('textbox', { name: 'Підпис' }).fill('Visible now card');
    await page.getByLabel('Дата й час').fill(new Date(Date.now() - 60000).toISOString().slice(0, 16));
    await page.getByRole('button', { name: /Запланувати розсилку|Заплановано/ }).click();
    await page.goto('/?demo=student#/home');
    await expect(page.getByText('Visible now card')).toBeVisible();
});

test('flashcard queue repeats mistakes, finishes due cards and isolates students', async ({ page }) => {
    await openFresh(page, '/?demo=student#/cards');
    await expect(page.getByRole('heading', { name: '1 / 4', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'yet', exact: true })).toBeVisible();
    await swipeFlashcard(page, 'left');
    await expect(page.getByRole('heading', { name: '2 / 5', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'recommend', exact: true })).toBeVisible();
    for (const next of ['ever', 'already', 'yet']) {
        await swipeFlashcard(page, 'right');
        await expect(page.getByRole('heading', { name: next, exact: true })).toBeVisible();
    }
    await swipeFlashcard(page, 'right');
    await expect(page.getByRole('heading', { name: 'Готово.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Готово.' })).toBeVisible();
    await page.goto('/?demo=student-b#/cards');
    await expect(page.getByRole('heading', { name: '1 / 3', exact: true })).toBeVisible();
});

test('a valid lesson draft survives refresh and is visible in teacher preview', async ({ page }) => {
    await openFresh(page, '/?demo=teacher#/teacher/lessons/1');
    await page.getByRole('textbox', { name: 'Назва уроку' }).fill('Present Perfect · перевірено');
    await page.getByRole('button', { name: /Зберегти 8 блоків/ }).click();
    await expect(page.getByRole('button', { name: 'Чернетку збережено' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Назва уроку' })).toHaveValue('Present Perfect · перевірено');
    await page.getByRole('button', { name: 'Передпоказ уроку' }).click();
    await expect(page.getByRole('heading', { name: 'Present Perfect · перевірено', exact: true })).toBeVisible();
    await expect(page.getByText(/прогрес учня не змінюється/)).toBeVisible();
});

test('broadcast view state is per student and deletion removes it for everyone', async ({ page }) => {
    await openFresh(page, '/?demo=student#/home');
    const broadcast = page.getByRole('button', { name: /Нове слово дня вже чекає/ });
    await expect(broadcast).toBeVisible();
    await broadcast.click();
    await page.reload();
    await expect(page.getByText('Нове слово дня вже чекає ☕')).toHaveCount(0);
    await page.goto('/?demo=student-b#/home');
    await expect(page.getByText('Нове слово дня вже чекає ☕')).toBeVisible();
    await page.goto('/?demo=teacher#/teacher/broadcasts');
    await page.getByRole('button', { name: /Видалити розсилку Нове слово дня/ }).click();
    await page.goto('/?demo=student-b#/home');
    await expect(page.getByText('Нове слово дня вже чекає ☕')).toHaveCount(0);
});

test('a supported homework attachment reaches the teacher', async ({ page }) => {
    await openFresh(page, '/?demo=student#/lesson/1/homework');
    await page.getByRole('textbox', { name: 'Відповідь' }).fill('Please check the attached worksheet.');
    await page.locator('input[type=file]').setInputFiles({ name: 'worksheet.pdf', mimeType: 'application/pdf', buffer: Buffer.from('safe pdf fixture') });
    await expect(page.getByText('Прикріплено: worksheet.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Надіслати на перевірку' }).click();
    await expect(page.getByRole('status')).toContainText('Роботу збережено');
    await page.goto('/?demo=teacher#/teacher/homework');
    await page.getByRole('button', { name: /Андрій Чекає Present Perfect/ }).click();
    const attachment = page.getByRole('link', { name: 'Завантажити: worksheet.pdf' });
    await expect(attachment).toBeVisible();
    const url = await attachment.getAttribute('href');
    const bytes = await page.evaluate(async href => await (await fetch(href!)).text(), url);
    expect(bytes).toBe('safe pdf fixture');
});

test('supporting screens and unknown deep links have controlled UI states', async ({ page }) => {
    await openFresh(page, '/?demo=student#/schedule');
    await expect(page.getByRole('heading', { name: 'Розклад.' })).toBeVisible();
    await page.goto('/?demo=student#/profile');
    await expect(page.getByRole('heading', { name: 'Андрій' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Досягнення' })).toBeVisible();
    await page.goto('/?demo=teacher#/teacher/statistics');
    await expect(page.getByRole('heading', { name: 'Статистика.' })).toBeVisible();
    await expect(page.getByText('Intermediate English')).toBeVisible();
    await page.goto('/?demo=student#/does-not-exist');
    await expect(page.getByRole('heading', { name: 'Такої сторінки немає.' })).toBeVisible();
});

test('critical screens do not overflow three supported phone widths', async ({ page }) => {
    for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
        await page.setViewportSize(viewport);
        for (const route of ['/?demo=student#/home', '/?demo=student#/course', '/?demo=student#/lesson/1/homework', '/?demo=teacher#/teacher', '/?demo=teacher#/teacher/courses']) {
            await page.goto(route);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(1);
        }
    }
});
