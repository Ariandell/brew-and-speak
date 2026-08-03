// Homework answers are typed into a plain <textarea>, so the app itself never
// produces markup. Some mobile keyboards and in-app browsers (Telegram's WebView
// on Android in particular) paste the clipboard's rich-text flavour into plain
// fields, so answers can arrive as "<p>line one</p><p>line two</p>" and get
// stored verbatim. Convert that back to the line breaks the student meant.

// Matches a real tag (<p>, </p>, <br/>) but not a stray "<" like in "a < b".
const HTML_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;

const ENTITIES: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
};

/**
 * Returns the text as the student meant it. Strings without HTML tags are
 * returned untouched, so plain answers keep their exact original formatting.
 */
export const toPlainText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    if (!HTML_TAG.test(value)) return value;

    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '• ')
        .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|blockquote)\s*>/gi, '\n')
        // Strip whatever tags are left (<b>, <span style=...>, <img ...>, ...)
        .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '')
        // Decode entities last, so an escaped "&lt;b&gt;" stays literal text
        .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi, m => ENTITIES[m.toLowerCase()] ?? m)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
