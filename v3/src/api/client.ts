import { z } from 'zod';
import { apiErrorSchema, type ApiErrorBody } from './contracts.js';

export class ApiError extends Error {
  readonly body: ApiErrorBody | null;

  constructor(
    readonly status: number,
    message: string,
    body: ApiErrorBody | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.body = body;
  }
}

export type InitDataProvider = () => string | null;

export type ApiClientOptions = {
  baseUrl?: string;
  getInitData: InitDataProvider;
  fetcher?: typeof fetch;
};

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
    body?: unknown;
  headers?: Record<string, string>;
  expectedStatus?: number;
};

const jsonSchema = z.unknown();

const parseJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  return response.json().catch(() => undefined);
};

export const createApiClient = ({
  baseUrl = '/api/v2',
  getInitData,
  fetcher = fetch,
}: ApiClientOptions) => ({
  async download(path: string, signal?: AbortSignal): Promise<Blob> {
    const headers = new Headers();
    const initData = getInitData();
    if (initData) headers.set('X-Telegram-Init-Data', initData);
    const response = await fetcher(`${baseUrl}${path}`, { headers, signal, cache: 'no-store' });
    if (!response.ok) {
      const error = apiErrorSchema.safeParse(await parseJson(response));
      throw new ApiError(response.status, error.success ? error.data.message : 'Не вдалося завантажити файл', error.success ? error.data : null);
    }
    return response.blob();
  },
  async request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
    const { expectedStatus, ...requestOptions } = options;
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    const initData = getInitData();
    if (initData) headers.set('X-Telegram-Init-Data', initData);

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData || typeof options.body === 'string') {
        body = options.body;
      } else {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(options.body);
      }
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      ...requestOptions,
      headers,
      body,
    });
    const payload = await parseJson(response);

    if (!response.ok) {
      const parsedError = apiErrorSchema.safeParse(payload);
      if (parsedError.success) {
        throw new ApiError(response.status, parsedError.data.message, parsedError.data);
      }
      throw new ApiError(response.status, `API request failed with status ${response.status}`);
    }

    if (expectedStatus !== undefined && response.status !== expectedStatus) {
      throw new ApiError(response.status, `API returned unexpected status ${response.status}; expected ${expectedStatus}`);
    }
    const parsed = jsonSchema.pipe(schema).safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(response.status, 'API returned an invalid response');
    }
    return parsed.data;
  },
});

export type ApiClient = ReturnType<typeof createApiClient>;
