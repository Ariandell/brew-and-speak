/**
 * The one place that talks to the server.
 *
 * It throws on any non-2xx instead of returning the parsed body. That single
 * rule removes a whole class of failure the previous app kept hitting: an
 * error body is an object, and an object put into state where a list was
 * expected throws on the first .map during render, which unmounts the tree and
 * leaves a blank screen. Here a failure cannot be mistaken for data.
 */

export class ApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    let res: Response;
    try {
        res = await fetch(path, {
            ...init,
            headers: { 'Content-Type': 'application/json', ...init?.headers },
        });
    } catch {
        throw new ApiError(0, 'Немає звʼязку з сервером');
    }

    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, body?.error || `Помилка сервера (${res.status})`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
};

export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
    patch: <T>(path: string, body?: unknown) =>
        request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
};
