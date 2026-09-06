import type { NextFunction, Request, Response } from 'express';
import { TelegramAuthError, verifyTelegramInitData, type TelegramIdentity } from './verifyInitData.js';

export type AuthenticatedLocals = {
  telegram: TelegramIdentity;
};

export type TelegramAuthConfig = {
  botToken: string;
  maxAgeSeconds?: number;
};

const authFailure = (response: Response, message: string) => {
  response.status(401).json({
    code: 'UNAUTHENTICATED',
    message,
    requestId: crypto.randomUUID(),
  });
};

export const requireTelegramAuth = (config: TelegramAuthConfig) => (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  const rawInitData = request.header('X-Telegram-Init-Data');
  if (!rawInitData) {
    authFailure(response, 'Потрібна авторизація Telegram');
    return;
  }

  try {
    const identity = verifyTelegramInitData(
      rawInitData,
      config.botToken,
      Math.floor(Date.now() / 1000),
      config.maxAgeSeconds,
    );
    response.locals.telegram = identity;
    next();
  } catch (error) {
    const message = error instanceof TelegramAuthError
      ? 'Авторизація Telegram недійсна або прострочена'
      : 'Не вдалося перевірити авторизацію Telegram';
    authFailure(response, message);
  }
};

