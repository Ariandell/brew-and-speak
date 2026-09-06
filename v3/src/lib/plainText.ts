const HTML_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;
const entities: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };

export const toPlainText = (value: string): string => {
    if (!HTML_TAG.test(value)) return value;
    return value
        .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '• ')
        .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|blockquote)\s*>/gi, '\n')
        .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '')
        .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi, item => entities[item.toLowerCase()] ?? item)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
