import React from 'react';

// Lesson copy is written elsewhere (ChatGPT, Google Docs) and pasted in, so it
// arrives as HTML: the live course holds 34 <strong> and 18 <em> spans that the
// teacher used to head each exercise. Stripping the tags kept the words but
// threw away that structure, so render a small allowlist of them instead.
//
// Nothing here ever reaches innerHTML. The browser parses the string, we walk
// the result and rebuild it as React elements, and no attribute is ever copied
// across - so there is no href, no src, no onerror, and no way for markup in
// the content to execute anything.

const TAGS: Record<string, string> = {
    p: 'p', br: 'br', strong: 'strong', b: 'strong', em: 'em', i: 'em',
    u: 'u', ul: 'ul', ol: 'ol', li: 'li', h1: 'h4', h2: 'h4', h3: 'h4', h4: 'h4',
};

// Dropped with their contents rather than unwrapped like other unknown tags.
const DROP: ReadonlySet<string> = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta']);

const HAS_TAGS = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;

const renderNodes = (nodes: ArrayLike<ChildNode>): React.ReactNode[] =>
    Array.from(nodes).map((node, i) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE) return null;

        const el = node as Element;
        const name = el.tagName.toLowerCase();
        if (DROP.has(name)) return null;
        if (name === 'br') return <br key={i} />;

        const children = renderNodes(el.childNodes);
        const tag = TAGS[name];
        // An unknown tag keeps its text but loses the wrapper.
        if (!tag) return <React.Fragment key={i}>{children}</React.Fragment>;
        return React.createElement(tag, { key: i }, children.length ? children : undefined);
    });

/**
 * Renders the teacher's formatting. Text with no tags is shown exactly as
 * written, newlines and all, so plain content is untouched.
 */
export const RichText: React.FC<{ value: unknown; style?: React.CSSProperties }> = ({ value, style }) => {
    const raw = typeof value === 'string' ? value : '';
    if (!raw.trim()) return null;

    if (!HAS_TAGS.test(raw)) {
        return <p style={{ margin: 0, whiteSpace: 'pre-wrap', ...style }}>{raw}</p>;
    }

    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return <div className="rich-text" style={style}>{renderNodes(doc.body.childNodes)}</div>;
};
