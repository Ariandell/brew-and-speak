import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramIdentity = {
  telegramId: string;
  name: string;
  username: string | null;
  authDate: number;
};

export class TelegramAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelegramAuthError';
  }
}

const hexHash = /^[a-f0-9]{64}$/i;

const equalHash = (expected: string, actual: string): boolean => {
  if (!hexHash.test(expected) || !hexHash.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
};

export const verifyTelegramInitData = (
  rawInitData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 86_400,
): TelegramIdentity => {
  if (!rawInitData || !botToken) throw new TelegramAuthError('Telegram auth data is missing');

  const params = new URLSearchParams(rawInitData);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) throw new TelegramAuthError('Duplicate Telegram auth fields');
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new TelegramAuthError('Telegram auth hash is missing');

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (!equalHash(calculatedHash, receivedHash)) {
    throw new TelegramAuthError('Telegram auth hash is invalid');
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate) || authDate <= 0 || authDate > nowSeconds + 30 || nowSeconds - authDate > maxAgeSeconds) {
    throw new TelegramAuthError('Telegram auth data is expired');
  }

  const rawUser = params.get('user');
  if (!rawUser) throw new TelegramAuthError('Telegram user is missing');

  let user: { id?: unknown; first_name?: unknown; last_name?: unknown; username?: unknown };
  try {
    user = JSON.parse(rawUser) as typeof user;
  } catch {
    throw new TelegramAuthError('Telegram user data is invalid');
  }

  if (!user || typeof user !== 'object' || Array.isArray(user)
    || !/^[1-9]\d*$/.test(String(user.id)) || !Number.isSafeInteger(Number(user.id))) {
    throw new TelegramAuthError('Telegram user ID is invalid');
  }

  const name = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .trim();

  return {
    telegramId: String(user.id),
    name: name || 'Telegram user',
    username: typeof user.username === 'string' ? user.username : null,
    authDate,
  };
};
