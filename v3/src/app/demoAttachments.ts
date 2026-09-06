/** Demo-only blob storage. Production attachments must use authenticated HTTP. */
const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    if (!import.meta.env.DEV) return reject(new Error('Demo attachments are disabled'));
    const request = indexedDB.open('english-with-coffee-demo-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Не вдалося відкрити сховище файлів.'));
});

export async function saveDemoAttachment(file: File): Promise<string> {
    if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Файл має бути непорожнім і не більшим за 20 МБ.');
    const database = await open();
    const id = crypto.randomUUID();
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction('files', 'readwrite');
            transaction.objectStore('files').put(file, id);
            transaction.oncomplete = () => resolve();
            transaction.onabort = transaction.onerror = () => reject(new Error('Не вдалося зберегти файл. Перевір вільне місце.'));
        });
        return id;
    } finally { database.close(); }
}

export async function readDemoAttachment(id: string): Promise<Blob> {
    const database = await open();
    try {
        return await new Promise<Blob>((resolve, reject) => {
            const request = database.transaction('files').objectStore('files').get(id);
            request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error('Файл недоступний у цьому браузері.'));
            request.onerror = () => reject(new Error('Не вдалося прочитати файл.'));
        });
    } finally { database.close(); }
}
