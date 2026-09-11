const HTML_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;
const entities: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };

const decodeEntities = (value: string): string => value
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi, item => entities[item.toLowerCase()] ?? item)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (item, code: string) => {
        const point = code[0].toLowerCase() === 'x' ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
        try { return Number.isSafeInteger(point) ? String.fromCodePoint(point) : item; } catch { return item; }
    });

export const toPlainText = (value: string): string => {
    const decoded = decodeEntities(value);
    if (!HTML_TAG.test(decoded)) return decoded;
    return decoded
        .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '• ')
        .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|blockquote)\s*>/gi, '\n')
        .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
