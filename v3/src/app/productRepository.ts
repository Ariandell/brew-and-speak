import type { ProductState } from './productTypes';

const STORAGE_KEY = 'english-with-coffee:product-demo:v3';

export interface ProductStateRepository {
    readonly persistent: boolean;
    load(): ProductState | null;
    save(state: ProductState): void;
    clear(): void;
    subscribe(listener: (state: ProductState) => void): () => void;
}

const parseState = (value: string | null): ProductState | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as ProductState;
    } catch {
        return null;
    }
};

export const createDemoProductRepository = (): ProductStateRepository => {
    const persistent = import.meta.env.DEV;

    return {
        persistent,
        load: () => persistent ? parseState(window.localStorage.getItem(STORAGE_KEY)) : null,
        save: state => {
            if (persistent) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        },
        clear: () => {
            if (persistent) window.localStorage.removeItem(STORAGE_KEY);
        },
        subscribe: listener => {
            if (!persistent) return () => undefined;
            const onStorage = (event: StorageEvent) => {
                if (event.key !== STORAGE_KEY) return;
                const state = parseState(event.newValue);
                if (state) listener(state);
            };
            window.addEventListener('storage', onStorage);
            return () => window.removeEventListener('storage', onStorage);
        },
    };
};
