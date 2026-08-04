import React from 'react';
import { TAGS, DROP, HAS_TAGS } from './richTextHtml';

// Renders the teacher's formatting. Nothing here reaches innerHTML: the browser
// parses the string, we walk the result and rebuild it as React elements, and no
// attribute is ever carried across - so there is no href, no src, no onerror,
// and no way for pasted markup to execute anything.

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
 * Text with no tags is shown exactly as written, newlines and all, so plain
 * content is untouched.
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
