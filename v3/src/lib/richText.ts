export const RICH_TAGS: Record<string, string> = {
    p: 'p', br: 'br', strong: 'strong', b: 'strong', em: 'em', i: 'em', u: 'u',
    ul: 'ul', ol: 'ol', li: 'li', h1: 'h2', h2: 'h2', h3: 'h3', blockquote: 'blockquote',
};

const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'head']);
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const serialize = (nodes: ArrayLike<ChildNode>): string => Array.from(nodes).map(node => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as Element;
    const source = element.tagName.toLowerCase();
    if (DROP.has(source)) return '';
    const tag = RICH_TAGS[source];
    const inner = serialize(element.childNodes);
    if (!tag) return inner;
    return tag === 'br' ? '<br>' : `<${tag}>${inner}</${tag}>`;
}).join('');

export const sanitizeRichText = (raw: string): string => {
    const document = new DOMParser().parseFromString(raw, 'text/html');
    return serialize(document.body.childNodes).replace(/<p>(\s|&nbsp;)*<\/p>/gi, '<p><br></p>').trim();
};

export const plainTextToHtml = (text: string): string => escapeText(text).replace(/\r?\n/g, '<br>');
