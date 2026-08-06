// A tiny browser driver over the Chrome DevTools Protocol, used to walk the app
// the way a person does: click things, type into them, and screenshot what
// comes back. Node's built-in WebSocket does the talking, so there is no
// Playwright or Puppeteer to install.
//
// Not a test framework - a pair of hands. The flow scripts decide what to press.

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export const launch = async ({ profile, width = 480, height = 900, port = 9222 }) => {
    fs.rmSync(profile, { recursive: true, force: true });
    const proc = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
        `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`, 'about:blank',
    ], { stdio: 'ignore', detached: false });

    // Chrome writes the endpoint only once it is listening.
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
        await new Promise(r => setTimeout(r, 300));
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            target = list.find(t => t.type === 'page');
        } catch { }
    }
    if (!target) throw new Error('Chrome не піднявся');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 0;
    const pending = new Map();
    ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    /**
     * Pretends the page is running inside Telegram as `user`. The real SDK is
     * blocked first, otherwise it loads and replaces the stub - and with it the
     * identity the app reads. This exercises the shipped production bundle,
     * where the development shortcut for admin has been compiled out.
     */
    const asTelegramUser = async (user) => {
        await send('Network.setBlockedURLs', { urls: ['*telegram-web-app.js*'] });
        await send('Page.addScriptToEvaluateOnNewDocument', {
            source: `window.Telegram = { WebApp: {
                ready(){}, expand(){}, close(){},
                initDataUnsafe: { user: ${JSON.stringify(user)} },
                initData: '', colorScheme: 'light', themeParams: {},
                MainButton: { show(){}, hide(){}, setText(){}, onClick(){} },
                BackButton: { show(){}, hide(){}, onClick(){} },
                HapticFeedback: { impactOccurred(){}, notificationOccurred(){} },
                setHeaderColor(){}, setBackgroundColor(){}, enableClosingConfirmation(){},
            }};`,
        });
    };

    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'JS error');
        return r.result.value;
    };

    const api = {
        asTelegramUser,
        async goto(url, settle = 1500) {
            await send('Page.navigate', { url });
            await new Promise(r => setTimeout(r, settle));
        },
        evaluate,
        /** Clicks the first element whose text contains `text`. Returns false if absent. */
        async clickText(text, selector = 'button, a, div[role=button], label') {
            return evaluate(`(() => {
                const wanted = ${JSON.stringify(text)};
                const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
                    .find(e => (e.innerText || '').replace(/\\s+/g,' ').trim().includes(wanted));
                if (!el) return false;
                el.scrollIntoView({ block: 'center' });
                el.click();
                return true;
            })()`);
        },
        async click(selector, index = 0) {
            return evaluate(`(() => {
                const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
                if (!el) return false;
                el.scrollIntoView({ block: 'center' });
                el.click();
                return true;
            })()`);
        },
        /** Types into an input/textarea the way React expects, so state updates. */
        async fill(selector, value, index = 0) {
            return evaluate(`(() => {
                const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
                if (!el) return false;
                const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
                const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
                setter.call(el, ${JSON.stringify(value)});
                el.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            })()`);
        },
        text() { return evaluate(`document.body.innerText.replace(/\\n{2,}/g,'\\n')`); },
        url() { return evaluate('location.pathname'); },
        async wait(ms) { await new Promise(r => setTimeout(r, ms)); },
        async shot(file) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const { data } = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(file, Buffer.from(data, 'base64'));
            return file;
        },
        async close() { try { ws.close(); } catch { } try { proc.kill(); } catch { } },
    };
    return api;
};
