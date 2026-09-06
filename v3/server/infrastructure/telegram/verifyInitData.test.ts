import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramAuthError, verifyTelegramInitData } from './verifyInitData.js';

const token = 'test-bot-token';
const now = 1_700_000_000;

const signedInitData = (authDate = now - 60): string => {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    user: JSON.stringify({ id: 42, first_name: 'Test', username: 'student' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
};

test('Telegram initData verifies and returns only signed identity', () => {
  assert.deepEqual(verifyTelegramInitData(signedInitData(), token, now), {
    telegramId: '42',
    name: 'Test',
    username: 'student',
    authDate: now - 60,
  });
});

test('Telegram initData rejects tampering and expired auth', () => {
  const tampered = signedInitData().replace('student', 'attacker');
  assert.throws(() => verifyTelegramInitData(tampered, token, now), TelegramAuthError);
  assert.throws(() => verifyTelegramInitData(signedInitData(now - 86_401), token, now), TelegramAuthError);
});

test('Telegram initData rejects future dates and duplicate identity fields', () => {
  assert.throws(() => verifyTelegramInitData(signedInitData(now + 3600), token, now), TelegramAuthError);
  assert.throws(() => verifyTelegramInitData(`${signedInitData()}&auth_date=${now}`, token, now), TelegramAuthError);
});
