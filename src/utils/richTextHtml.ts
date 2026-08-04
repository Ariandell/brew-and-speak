// The one allowlist shared by the editor and the renderer, so what a teacher
// can create is exactly what a student can see.
//
// Lesson copy is authored in ChatGPT or Google Docs and pasted in, which is why
// it arrives as HTML at all. We keep the handful of tags that carry meaning and
// drop everything else, attributes included - no href, no src, no event
// handlers, no inline styles ever survive.

export const TAGS: Record<string, string> = {
    p: 'p', br: 'br', strong: 'strong', b: 'strong', em: 'em', i: 'em',
    u: 'u', ul: 'ul', ol: 'ol', li: 'li', h1: 'h4', h2: 'h4', h3: 'h4', h4: 'h4',
};

// Dropped with their contents; every other unknown tag is unwrapped instead.
export const DROP: ReadonlySet<string> = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'head']);

export const HAS_TAGS = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;

const VOID_TAGS: ReadonlySet<string> = new Set(['br']);

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const serialize = (nodes: ArrayLike<ChildNode>): string =>
    Array.from(nodes).map(node => {
        if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent || '');
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as Element;
        const name = el.tagName.toLowerCase();
        if (DROP.has(name)) return '';

        const tag = TAGS[name];
        if (tag && VOID_TAGS.has(tag)) return `<${tag}>`;

        const inner = serialize(el.childNodes);
        if (!tag) return inner; // unknown tag: keep the words, lose the wrapper
        return `<${tag}>${inner}</${tag}>`;
    }).join('');

/**
 * Reduces arbitrary HTML to the allowlist above. Used when storing what the
 * editor produced and when accepting a paste, so nothing outside the list is
 * ever written to the database.
 */
export const sanitizeHtml = (raw: string): string => {
    if (!raw) return '';
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return serialize(doc.body.childNodes)
        // Editors love leaving empty wrappers behind when you delete a line.
        .replace(/<p>(\s|&nbsp;)*<\/p>/gi, '<p><br></p>')
        .trim();
};

/** Plain text as typed, escaped and with newlines kept, for non-HTML input. */
export const textToHtml = (text: string): string =>
    escapeText(text).replace(/\r?\n/g, '<br>');
