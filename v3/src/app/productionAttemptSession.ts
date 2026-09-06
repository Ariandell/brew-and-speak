export type StoredOutcome = 'correct' | 'wrong';

export type ProductionAttemptSession = {
    attempts: Record<number, string>;
    outcomes: Record<number, Record<number, StoredOutcome>>;
};

const key = (userId: number) => `english-with-coffee:attempts:v1:${userId}`;
const empty = (): ProductionAttemptSession => ({ attempts: {}, outcomes: {} });

export const readProductionAttemptSession = (userId: number): ProductionAttemptSession => {
    try {
        const raw = JSON.parse(sessionStorage.getItem(key(userId)) ?? 'null') as unknown;
        if (!raw || typeof raw !== 'object') return empty();
        const source = raw as { attempts?: unknown; outcomes?: unknown };
        const result = empty();
        if (source.attempts && typeof source.attempts === 'object') {
            for (const [lessonKey, attemptId] of Object.entries(source.attempts)) {
                const lessonId = Number(lessonKey);
                if (Number.isSafeInteger(lessonId) && lessonId > 0 && typeof attemptId === 'string'
                    && attemptId.length > 0 && attemptId.length <= 80) result.attempts[lessonId] = attemptId;
            }
        }
        if (source.outcomes && typeof source.outcomes === 'object') {
            for (const [lessonKey, values] of Object.entries(source.outcomes)) {
                const lessonId = Number(lessonKey);
                if (!Number.isSafeInteger(lessonId) || lessonId <= 0 || !values || typeof values !== 'object') continue;
                const outcomes: Record<number, StoredOutcome> = {};
                for (const [blockKey, outcome] of Object.entries(values)) {
                    const blockId = Number(blockKey);
                    if (Number.isSafeInteger(blockId) && blockId > 0 && (outcome === 'correct' || outcome === 'wrong')) {
                        outcomes[blockId] = outcome;
                    }
                }
                if (Object.keys(outcomes).length) result.outcomes[lessonId] = outcomes;
            }
        }
        return result;
    } catch {
        return empty();
    }
};

export const writeProductionAttemptSession = (userId: number, value: ProductionAttemptSession): void => {
    try { sessionStorage.setItem(key(userId), JSON.stringify(value)); } catch { /* progress remains server-owned */ }
};

export const clearProductionLessonSession = (userId: number, lessonId: number): ProductionAttemptSession => {
    const value = readProductionAttemptSession(userId);
    delete value.attempts[lessonId];
    delete value.outcomes[lessonId];
    writeProductionAttemptSession(userId, value);
    return value;
};
