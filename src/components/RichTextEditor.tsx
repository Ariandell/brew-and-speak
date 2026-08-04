import React, { useRef, useEffect } from 'react';
import { sanitizeHtml, textToHtml, HAS_TAGS } from '../utils/richTextHtml';

// A small formatting editor for lesson copy. It exists because the teacher had
// no way to make text bold in the app, so she wrote lessons in ChatGPT and
// pasted them in - which is how HTML ended up in the database in the first
// place. Now she can format here, and a paste is cleaned on the way in.

interface Props {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: number;
}

const buttonStyle: React.CSSProperties = {
    minWidth: 34, height: 32, border: '1px solid #e2e8f0', borderRadius: '8px',
    background: 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem',
    color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 8px',
};

export const RichTextEditor: React.FC<Props> = ({ value, onChange, placeholder, minHeight = 110 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const ownValue = useRef<string>('');

    // Seed the node from props only when the change came from somewhere else.
    // Writing back what the user just typed would reset the caret to the start.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const incoming = value || '';
        if (incoming === ownValue.current) return;
        el.innerHTML = HAS_TAGS.test(incoming) ? incoming : textToHtml(incoming);
        ownValue.current = incoming;
    }, [value]);

    const emit = () => {
        const html = sanitizeHtml(ref.current?.innerHTML || '');
        ownValue.current = html;
        onChange(html);
    };

    // execCommand is deprecated but is still the only thing every mobile
    // browser implements for this, and Telegram's WebView is the target here.
    const exec = (command: string) => {
        ref.current?.focus();
        document.execCommand(command, false);
        emit();
    };

    const onPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        const clean = html ? sanitizeHtml(html) : textToHtml(text);
        document.execCommand('insertHTML', false, clean);
        emit();
    };

    const isEmpty = !String(value || '').replace(/<[^>]*>|&nbsp;|\s/g, '');

    return (
        <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                {/* mousedown rather than click: the button must not steal the selection */}
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')}
                    style={{ ...buttonStyle, fontWeight: 800 }} title="Жирний">Ж</button>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')}
                    style={{ ...buttonStyle, fontStyle: 'italic' }} title="Курсив">К</button>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')}
                    style={{ ...buttonStyle, textDecoration: 'underline' }} title="Підкреслений">П</button>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')}
                    style={buttonStyle} title="Список">• Список</button>
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec('removeFormat')}
                    style={{ ...buttonStyle, color: '#94a3b8' }} title="Прибрати форматування">Очистити</button>
            </div>

            <div style={{ position: 'relative' }}>
                <div
                    ref={ref}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={emit}
                    onBlur={emit}
                    onPaste={onPaste}
                    className="rich-text rich-editor"
                    style={{
                        minHeight, width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                        borderRadius: '10px', fontSize: '0.95rem', fontFamily: 'inherit',
                        boxSizing: 'border-box', outline: 'none', background: '#fafafa',
                        lineHeight: 1.6, overflowWrap: 'anywhere',
                    }}
                />
                {isEmpty && placeholder && (
                    <span style={{
                        position: 'absolute', top: 10, left: 13, color: '#adb5bd',
                        pointerEvents: 'none', fontSize: '0.95rem',
                    }}>{placeholder}</span>
                )}
            </div>
        </div>
    );
};
