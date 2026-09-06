import { ApiError } from './client.js';

/** Pass the signed SDK payload unchanged; only the server verifies its identity. */
export function getTelegramInitData(): string {
    const telegramWindow = typeof window === 'undefined' ? undefined : window as Window & {
        Telegram?: { WebApp?: { initData?: unknown } };
    };
    const initData = telegramWindow?.Telegram?.WebApp?.initData;
    if (typeof initData !== 'string' || !initData.trim()) {
        throw new ApiError(401, 'Telegram Mini App initData is required');
    }
    return initData;
}
