import { useEffect, useRef, type ClipboardEvent } from 'react';
import { plainTextToHtml, sanitizeRichText } from '../lib/richText';

export const RichTextDraftEditor = ({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) => {
    const editor = useRef<HTMLDivElement>(null);
    const ownValue = useRef('');
    const savedSelection = useRef<Range | null>(null);
    const rememberSelection = () => {
        const selection = window.getSelection();
        if (selection?.rangeCount && editor.current?.contains(selection.anchorNode) && editor.current.contains(selection.focusNode)) {
            savedSelection.current = selection.getRangeAt(0).cloneRange();
        }
    };
    useEffect(() => {
        document.addEventListener('selectionchange', rememberSelection);
        return () => document.removeEventListener('selectionchange', rememberSelection);
    }, []);
    useEffect(() => {
        if (!editor.current || ownValue.current === value) return;
        editor.current.innerHTML = sanitizeRichText(value);
        ownValue.current = value;
    }, [value]);
    const emit = () => {
        const clean = sanitizeRichText(editor.current?.innerHTML ?? '');
        ownValue.current = clean;
        onChange(clean);
    };
    const command = (name: string) => {
        editor.current?.focus();
        if (savedSelection.current && editor.current?.contains(savedSelection.current.commonAncestorContainer)) {
            const selection = window.getSelection();
            selection?.removeAllRanges(); selection?.addRange(savedSelection.current);
        }
        document.execCommand(name, false); rememberSelection(); emit();
    };
    const paste = (event: ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        const html = event.clipboardData.getData('text/html');
        const clean = html ? sanitizeRichText(html) : plainTextToHtml(event.clipboardData.getData('text/plain'));
        document.execCommand('insertHTML', false, clean);
        emit();
    };
    const tools = [['bold', 'Ж'], ['italic', 'К'], ['underline', 'П'], ['insertUnorderedList', '• Список'], ['removeFormat', 'Очистити']];
    const empty = !value.replace(/<[^>]*>|&nbsp;|\s/g, '');
    return <div>
        <div className="sticky top-0 z-10 mb-2 flex flex-wrap gap-1.5 rounded-xl bg-white p-2">{tools.map(([name, label]) => <button key={name} type="button" title={label} onPointerDown={event => { rememberSelection(); event.preventDefault(); }} onClick={() => command(name)} className="min-h-11 rounded-[9px] border border-line bg-surface px-3 text-[13px] font-black text-text-soft">{label}</button>)}</div>
        <div className="relative"><div ref={editor} role="textbox" aria-label={placeholder ?? 'Текст блоку'} aria-multiline="true" style={{ userSelect: 'text', WebkitUserSelect: 'text', whiteSpace: 'pre-wrap' }} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit} onPaste={paste} className="rich-text min-h-[180px] w-full rounded-[14px] border border-line bg-surface px-4 py-3 text-[16px] text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" />{empty && placeholder && <span className="pointer-events-none absolute left-4 top-3 text-[14px] font-semibold text-text-faint">{placeholder}</span>}</div>
    </div>;
};
