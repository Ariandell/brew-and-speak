export const RICH_TAGS: Record<string, string> = {
    div: 'div', p: 'p', br: 'br', strong: 'strong', b: 'strong', em: 'em', i: 'em', u: 'u',
    ul: 'ul', ol: 'ol', li: 'li', h1: 'h2', h2: 'h2', h3: 'h3', h4: 'h4', blockquote: 'blockquote',
};

const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'head']);
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const serialize = (nodes: ArrayLike<ChildNode>): string => Array.from(nodes).map(node => {
    if (node.nodeType === Node.TEXT_NODE) return plainTextToHtml(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as Element;
    const source = element.tagName.toLowerCase();
    if (DROP.has(source)) return '';
    const tag = RICH_TAGS[source];
    let inner = serialize(element.childNodes);
    const style = (element as HTMLElement).style;
    if (style?.fontWeight === 'bold' || Number(style?.fontWeight) >= 600) inner = `<strong>${inner}</strong>`;
    if (style?.fontStyle === 'italic') inner = `<em>${inner}</em>`;
    if (style?.textDecoration?.includes('underline') || style?.textDecorationLine?.includes('underline')) inner = `<u>${inner}</u>`;
    if (!tag) return inner;
    return tag === 'br' ? '<br>' : `<${tag}>${inner}</${tag}>`;
}).join('');

export const sanitizeRichText = (raw: string): string => {
    if (!/<\/?[a-z][^>]*>/i.test(raw)) return plainTextToHtml(raw);
    const document = new DOMParser().parseFromString(raw, 'text/html');
    return serialize(document.body.childNodes).replace(/<p>(\s|&nbsp;)*<\/p>/gi, '<p><br></p>').trim();
};

export const plainTextToHtml = (text: string): string => escapeText(text).replace(/\r?\n/g, '<br>');
