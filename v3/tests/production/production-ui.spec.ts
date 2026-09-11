import { createHmac } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const BOT_TOKEN = 'english-with-coffee-local-production-e2e-token';
const identities = {
  teacher: { id: 90001, firstName: 'Викладачка', username: 'coffee_teacher' },
  student: { id: 10101, firstName: 'Андрій', username: 'andrii_student' },
  other: { id: 10202, firstName: 'Марія', username: 'maria_student' },
  newcomer: { id: 30303, firstName: 'Новий', username: 'new_student' },
} as const;

type Identity = (typeof identities)[keyof typeof identities];
type TrackedPage = { context: BrowserContext; page: Page; errors: string[] };
const opened: TrackedPage[] = [];

const signedInitData = ({ id, firstName, username }: Identity): string => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id, first_name: firstName, username }),
  });
  const check = [...params.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
};

const openAs = async (browser: Browser, identity: Identity, hash: string): Promise<TrackedPage> => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const initData = signedInitData(identity);
  await context.route('https://telegram.org/js/telegram-web-app.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.Telegram=window.Telegram||{};window.Telegram.WebApp=window.Telegram.WebApp||{};',
  }));
  await context.addInitScript(value => {
    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      value: { WebApp: { initData: value, ready: () => undefined, expand: () => undefined } },
    });
  }, initData);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  const tracked = { context, page, errors };
  opened.push(tracked);
  await page.goto(`/#${hash.replace(/^#?\/?/, '/')}`);
  await expect(page.getByText('Завантажуємо English with Coffee…')).toHaveCount(0);
  return tracked;
};

const swipeCard = async (page: Page, direction: 'left' | 'right') => {
  const card = page.getByRole('button', { name: /^Картка / });
  await card.click();
  const box = await card.boundingBox();
  if (!box) throw new Error('Flashcard is not visible');
  const startX = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + (direction === 'right' ? 130 : -130), y, { steps: 8 });
  await page.mouse.up();
};

const allowExpectedHttpConsole = (tracked: TrackedPage, status: number) => {
  tracked.errors = tracked.errors.filter(message => !(
    message.includes('Failed to load resource') && message.includes(String(status))
  ));
};

test.afterEach(async () => {
  const errors: string[] = [];
  for (const tracked of opened.splice(0)) {
    errors.push(...tracked.errors);
    await tracked.context.close();
  }
  expect(errors, 'browser console/page errors').toEqual([]);
});

test('new signed Telegram student is provisioned and enrolls through the production UI', async ({ browser }) => {
  const { page } = await openAs(browser, identities.newcomer, '/welcome');
  await expect(page.getByRole('heading', { name: /English with Coffee/i })).toBeVisible();
  await page.getByRole('button', { name: /^Почати/ }).click();
  await expect(page.getByRole('heading', { name: 'Обери курс.' })).toBeVisible();
  const [enrollmentResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/v2/me/enrollment') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Обрати курс Intermediate English' }).click(),
  ]);
  expect(enrollmentResponse.status()).toBe(200);
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole('heading', { name: /ТВІЙ ДЕНЬ/ })).toBeVisible();
  await expect(page.getByText(/Intermediate English/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Intermediate English/)).toBeVisible();
  const me = await page.evaluate(async () => {
    const initData = (window as Window & { Telegram: { WebApp: { initData: string } } }).Telegram.WebApp.initData;
    return (await fetch('/api/v2/me', { headers: { 'X-Telegram-Init-Data': initData } })).json();
  });
  expect(me).toMatchObject({ name: 'Новий', role: 'student', enrollment: { courseId: 1 } });
});

test('student answers all five scored blocks and receives the honest server score', async ({ browser }) => {
  const { page } = await openAs(browser, identities.student, '/lesson/1');
  await expect(page.getByRole('heading', { name: 'Present Perfect', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'I have finished my coffee.' }).click();
  await page.getByRole('button', { name: 'has', exact: true }).click();
  await page.getByRole('button', { name: 'Вірно', exact: true }).click();
  for (const word of ['Have', 'you', 'ever', 'visited', 'London?']) {
    await page.getByRole('button', { name: word, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Перевірити порядок' }).click();
  const pairs = page.locator('select');
  await pairs.nth(0).selectOption({ label: 'вже' });
  await pairs.nth(1).selectOption({ label: 'ще' });
  await pairs.nth(2).selectOption({ label: 'коли-небудь' });
  await page.getByRole('button', { name: 'Перевірити пари' }).click();
  await page.getByRole('button', { name: 'Завершити урок' }).click();
  await expect(page.getByText(/8\s*із 10/)).toBeVisible();
  await expect(page.getByText('4', { exact: true })).toBeVisible();
  await expect(page.getByText('1', { exact: true })).toBeVisible();
});

test('homework travels student → teacher grade → student through production state', async ({ browser }) => {
  test.setTimeout(60_000);
  const answer = 'Production UI homework answer 6204';
  const student = await openAs(browser, identities.student, '/lesson/1/homework');
  await student.page.getByRole('textbox', { name: 'Відповідь' }).fill(answer);
  await student.page.getByRole('button', { name: 'Надіслати на перевірку' }).click();
  await expect(student.page.getByRole('status')).toContainText('Роботу збережено');

  const teacher = await openAs(browser, identities.teacher, '/teacher/homework');
  await teacher.page.getByRole('button', { name: /Андрій Чекає Present Perfect/ }).click();
  await expect(teacher.page.getByText(answer)).toBeVisible();
  await teacher.page.getByRole('slider').fill('7');
  await teacher.page.getByRole('textbox', { name: 'Коментар' }).fill('Перевірено production E2E.');
  await teacher.page.getByRole('button', { name: 'Зберегти оцінку' }).click();
  await expect(teacher.page.getByRole('button', { name: 'Оцінку збережено' })).toBeVisible();

  await student.page.reload();
  await expect(student.page.getByText('7/10')).toBeVisible();
  await expect(student.page.getByText('Перевірено production E2E.')).toBeVisible();
  await expect(student.page.getByText(answer)).toHaveCount(1);
  await student.page.goto('/#/home');
  await expect(student.page.getByRole('button', { name: 'Відкрити відгук до домашнього' })).toContainText('7');
  await expect(student.page.getByRole('button', { name: 'Відкрити відгук до домашнього' })).toContainText('Перевірено production E2E.');
  await student.page.getByRole('button', { name: 'Відкрити відгук до домашнього' }).click();
  await expect(student.page.getByRole('button', { name: 'Виправити й надіслати повторно' })).toBeVisible();
  const corrected = 'Corrected production UI homework answer 6204';
  await student.page.getByRole('textbox', { name: /Твоя відповідь/ }).fill(corrected);
  await student.page.getByRole('button', { name: 'Виправити й надіслати повторно' }).click();
  await expect(student.page.getByRole('status')).toContainText('Роботу збережено');
  await expect(student.page.getByText('7/10')).toHaveCount(0);
  await teacher.page.reload();
  await expect(teacher.page.getByText(corrected)).toBeVisible();
});

test('chat reply is visible only to its intended student', async ({ browser }) => {
  const student = await openAs(browser, identities.student, '/chat');
  await student.page.getByRole('textbox', { name: 'Повідомлення' }).fill('Private production question 7319');
  await student.page.getByRole('button', { name: 'Надіслати' }).click();
  await expect(student.page.getByText('Private production question 7319')).toBeVisible();

  const teacher = await openAs(browser, identities.teacher, '/teacher/chat');
  await teacher.page.getByRole('button', { name: /Андрій/ }).click();
  await expect(teacher.page.getByText('Private production question 7319')).toBeVisible();
  await teacher.page.getByRole('textbox', { name: 'Повідомлення' }).fill('Private production reply 7319');
  await teacher.page.getByRole('button', { name: 'Надіслати' }).click();
  await expect(teacher.page.getByText('Private production reply 7319')).toBeVisible();

  const other = await openAs(browser, identities.other, '/chat');
  await expect(other.page.getByText('Private production reply 7319')).toHaveCount(0);
  await student.page.reload();
  await expect(student.page.getByText('Private production reply 7319')).toBeVisible();
});

test('SRS swipe persists a real review and changes the due queue', async ({ browser }) => {
  const { page } = await openAs(browser, identities.student, '/cards');
  await expect(page.getByRole('heading', { name: '1 / 3', exact: true })).toBeVisible();
  const firstWord = await page.getByRole('button', { name: /^Картка / }).getAttribute('aria-label');
  await swipeCard(page, 'right');
  await expect(page.getByRole('heading', { name: '2 / 3', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '1 / 2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: firstWord ?? '' })).toHaveCount(0);
});

test('teacher creates a course, creates and edits a lesson, then removes both empty records', async ({ browser }) => {
  const { page } = await openAs(browser, identities.teacher, '/teacher/courses');
  await page.getByRole('button', { name: 'Створити курс' }).click();
  await page.getByRole('textbox', { name: 'Назва' }).fill('Production Speaking Lab');
  await page.getByRole('textbox', { name: 'Опис' }).fill('Ізольований E2E курс.');
  await page.getByRole('button', { name: 'Зберегти' }).click();
  await expect(page.getByText('Production Speaking Lab')).toBeVisible();
  await page.getByText('Production Speaking Lab').click();
  await page.getByLabel('Створити урок').click();
  await expect(page.getByRole('heading', { name: 'Редактор.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Назва уроку' }).fill('Production UI Lesson');
  await page.getByRole('button', { name: 'Зберегти урок і словник', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Урок і словник збережено' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Назва уроку' })).toHaveValue('Production UI Lesson');
  await page.goBack();
  await expect(page.getByText('Production UI Lesson')).toBeVisible();
  await page.getByRole('button', { name: 'Видалити чернетку' }).click();
  await expect(page.getByText('Production UI Lesson')).toHaveCount(0);
  await page.goBack();
  await page.getByRole('button', { name: 'Редагувати курс Production Speaking Lab' }).click();
  await page.getByRole('button', { name: 'Видалити порожній курс' }).click();
  await expect(page.getByText('Production Speaking Lab')).toHaveCount(0);
});

test('teacher block/unblock is enforced by the production API', async ({ browser }) => {
  const student = await openAs(browser, identities.student, '/profile');
  const teacher = await openAs(browser, identities.teacher, '/teacher/students/101');
  await teacher.page.getByRole('button', { name: 'Заблокувати доступ' }).click();
  await expect(teacher.page.getByText('Доступ учня заблоковано.')).toBeVisible();

  const blockedStatus = await student.page.evaluate(async () => {
    const initData = (window as Window & { Telegram: { WebApp: { initData: string } } }).Telegram.WebApp.initData;
    return (await fetch('/api/v2/me/course/path', { headers: { 'X-Telegram-Init-Data': initData } })).status;
  });
  expect(blockedStatus).toBe(403);
  allowExpectedHttpConsole(student, 403);
  await student.page.reload();
  await expect(student.page.getByRole('heading', { name: 'Навчання поки закрите.' })).toBeVisible();
  await teacher.page.getByRole('button', { name: 'Відновити доступ' }).click();
  await expect(teacher.page.getByText('Доступ учня відновлено.')).toBeVisible();
  await student.page.reload();
  await expect(student.page.getByRole('heading', { name: 'Андрій' })).toBeVisible();
});

test('scheduled photo is uploaded, hidden before schedule, then served with authenticated media', async ({ browser }) => {
  const teacher = await openAs(browser, identities.teacher, '/teacher/broadcasts');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await teacher.page.locator('input[type=file]').setInputFiles({ name: 'coffee.png', mimeType: 'image/png', buffer: png });
  await teacher.page.getByRole('textbox', { name: 'Підпис' }).fill('Production scheduled photo 8842');
  await teacher.page.getByLabel('Дата й час').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await teacher.page.getByRole('button', { name: 'Запланувати розсилку' }).click();
  await expect(teacher.page.getByText('Розсилку успішно заплановано.')).toBeVisible();

  const student = await openAs(browser, identities.other, '/home');
  await expect(student.page.getByText('Production scheduled photo 8842')).toHaveCount(0);

  await teacher.page.locator('input[type=file]').setInputFiles({ name: 'coffee-now.png', mimeType: 'image/png', buffer: png });
  await teacher.page.getByRole('textbox', { name: 'Підпис' }).fill('Production visible photo 8842');
  await teacher.page.getByLabel('Дата й час').fill(new Date(Date.now() - 60_000).toISOString().slice(0, 16));
  await teacher.page.getByRole('button', { name: 'Запланувати розсилку' }).click();
  await expect(teacher.page.getByText('Розсилку успішно заплановано.')).toBeVisible();
  await student.page.reload();
  await student.page.getByRole('button', { name: /Production visible photo 8842/ }).click();
  await expect(student.page.getByRole('dialog', { name: 'Повідомлення викладачки' })).toBeVisible();
  await expect(student.page.getByRole('img', { name: 'Фото від викладачки' })).toBeVisible();
  expect(await student.page.getByRole('img', { name: 'Фото від викладачки' }).getAttribute('src')).toMatch(/^blob:/);
});

test('role guards reject cross-role screens and protected API calls', async ({ browser }) => {
  const student = await openAs(browser, identities.other, '/teacher');
  await expect(student.page.getByRole('heading', { name: 'Недостатньо прав.' })).toBeVisible();
  const studentTeacherApiStatus = await student.page.evaluate(async () => {
    const initData = (window as Window & { Telegram: { WebApp: { initData: string } } }).Telegram.WebApp.initData;
    return (await fetch('/api/v2/teacher/students', { headers: { 'X-Telegram-Init-Data': initData } })).status;
  });
  expect(studentTeacherApiStatus).toBe(403);
  allowExpectedHttpConsole(student, 403);

  const teacher = await openAs(browser, identities.teacher, '/lesson/1');
  await expect(teacher.page.getByRole('heading', { name: 'Кабінет.' })).toBeVisible();
  const teacherStudentApiStatus = await teacher.page.evaluate(async () => {
    const initData = (window as Window & { Telegram: { WebApp: { initData: string } } }).Telegram.WebApp.initData;
    return (await fetch('/api/v2/me/dictionary', { headers: { 'X-Telegram-Init-Data': initData } })).status;
  });
  expect(teacherStudentApiStatus).toBe(403);
  allowExpectedHttpConsole(teacher, 403);
});

test('teacher formats blocks and imports vocabulary that becomes student cards', async ({ browser }) => {
  const { page } = await openAs(browser, identities.teacher, '/teacher/lessons/1');
  await expect(page.getByRole('heading', { name: '📖 Словник уроку (3 слів)' })).toBeVisible();
  await page.getByRole('button', { name: '+ Текст', exact: true }).click();
  const text = page.getByRole('textbox', { name: 'Текст уроку…', exact: true });
  await text.fill('Перший абзац');
  await text.press('End');
  await text.press('Enter');
  await page.keyboard.type('Другий абзац');
  await text.press('Control+a');
  const toolbar = page.getByRole('toolbar', { name: 'Форматування виділеного тексту' });
  await expect(toolbar).toBeVisible();
  const selectionBox = await text.boundingBox();
  const toolbarBox = await toolbar.boundingBox();
  expect(selectionBox && toolbarBox && toolbarBox.y > selectionBox.y).toBeTruthy();
  await toolbar.getByRole('button', { name: 'Ж', exact: true }).click();
  await page.getByText('Вставити список слів / з таблиці', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Список слів' }).fill('happy — щасливий\nexcited — схвильований');
  await page.getByRole('button', { name: 'Додати список', exact: true }).click();
  await page.getByRole('button', { name: 'Зберегти урок і словник', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Урок і словник збережено' })).toBeVisible();
  await page.reload();
  await expect(text).toContainText('Другий абзац');
  expect(await text.locator('div, p, br').count()).toBeGreaterThan(0);
  expect(await text.locator('strong, b').count()).toBeGreaterThan(0);
  await expect(page.getByRole('textbox', { name: 'Слово 4', exact: true })).toHaveValue('happy');
  await page.getByRole('heading', { name: /Словник уроку/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'node_modules/.cache/production-e2e/teacher-vocabulary.png', fullPage: true });
  await page.getByRole('button', { name: 'Передпоказ уроку' }).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(page.locator('.rich-text').filter({ hasText: 'Перший абзац' }).locator('div, p, br').first()).toBeVisible();
  await page.locator('.rich-text').filter({ hasText: 'Перший абзац' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'node_modules/.cache/production-e2e/teacher-formatting.png', fullPage: true });
  const student = await openAs(browser, identities.student, '/words');
  await expect(student.page.getByText('happy', { exact: true })).toBeVisible();
  await expect(student.page.getByText('excited', { exact: true })).toBeVisible();
});
