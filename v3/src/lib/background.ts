/**
 * The background, drawn on the GPU.
 *
 * No library. A background is one full-screen triangle and one fragment
 * shader; three.js would be six hundred kilobytes to do nothing else, and
 * this has to run inside Telegram on a mid-range Android.
 *
 * What makes it not look cheap, in order of how much each matters:
 *
 * 1. **Grain.** A smooth gradient on an 8-bit display bands into visible
 *    stripes. A little noise per pixel breaks the steps up and reads as
 *    photographic rather than generated. This is the single biggest one.
 * 2. **Noise-warped light.** The glows are not circles - their distance field
 *    is displaced by the same fbm that shades the surface, so the light has an
 *    irregular edge instead of a perfect ellipse.
 * 3. **Shading that agrees with the light.** The surface darkens using the
 *    same noise field, so highlight and shadow belong to one form.
 *
 * GLSL ES 1.0 on purpose: WebGL2 is not everywhere inside older Android
 * WebViews, and nothing here needs it.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uBase;
uniform vec3  uGlowA;
uniform vec3  uGlowB;
uniform float uReach;
uniform float uGrain;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.02;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.035;

    float n = fbm(p * 1.5 + vec2(t * 0.9, t * 0.5));
    float m = fbm(p * 2.3 + vec2(-t * 0.6, t * 0.8) + 11.3);

    vec2 c1 = vec2((0.28 + 0.13 * sin(t * 1.25)) * aspect, 0.72 + 0.09 * cos(t * 1.05));
    vec2 c2 = vec2((0.80 + 0.11 * cos(t * 0.85)) * aspect, 0.24 + 0.10 * sin(t * 1.35));

    float d1 = 1.0 - smoothstep(0.0, uReach, distance(p, c1) + (n - 0.5) * 0.55);
    float d2 = 1.0 - smoothstep(0.0, uReach * 0.9, distance(p, c2) + (m - 0.5) * 0.60);

    vec3 col = uBase;
    col = mix(col, uGlowA, clamp(d1, 0.0, 1.0) * 0.85);
    col = mix(col, uGlowB, clamp(d2, 0.0, 1.0) * 0.70);

    col *= 0.90 + 0.18 * n;

    float vig = 1.0 - smoothstep(0.35, 1.15, length(uv - 0.5) * 1.25);
    col *= mix(0.80, 1.0, vig);

    col += (hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) * uGrain;

    gl_FragColor = vec4(col, 1.0);
}
`;

export interface Palette {
    base: [number, number, number];
    glowA: [number, number, number];
    glowB: [number, number, number];
    reach: number;
    grain: number;
}

export interface Background {
    setPalette(palette: Palette): void;
    destroy(): void;
}

/** Above this the extra pixels cost real frames and buy nothing on a phone. */
const MAX_DPR = 1.25;
/** The motion is a slow drift; sixty frames a second of it is wasted battery. */
const FRAME_MS = 1000 / 30;

const compile = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Шейдер не скомпілювався:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
};

/**
 * Returns null when WebGL is unavailable, so the caller can leave its CSS
 * fallback in place. A background is decoration - it must never be the reason
 * a screen fails to render.
 */
export const createBackground = (
    canvas: HTMLCanvasElement,
    palette: Palette,
    still: boolean,
): Background | null => {
    const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, depth: false }) ??
        canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Програма не злінкувалась:', gl.getProgramInfoLog(program));
        return null;
    }
    gl.useProgram(program);

    // One triangle that covers the screen, not two. Fewer vertices, and no
    // seam down the diagonal where the two halves meet.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
        res: gl.getUniformLocation(program, 'uRes'),
        time: gl.getUniformLocation(program, 'uTime'),
        base: gl.getUniformLocation(program, 'uBase'),
        glowA: gl.getUniformLocation(program, 'uGlowA'),
        glowB: gl.getUniformLocation(program, 'uGlowB'),
        reach: gl.getUniformLocation(program, 'uReach'),
        grain: gl.getUniformLocation(program, 'uGrain'),
    };

    let current = palette;
    let raf = 0;
    let last = 0;
    let alive = true;

    const pushPalette = () => {
        gl.uniform3fv(u.base, current.base);
        gl.uniform3fv(u.glowA, current.glowA);
        gl.uniform3fv(u.glowB, current.glowB);
        gl.uniform1f(u.reach, current.reach);
        gl.uniform1f(u.grain, current.grain);
    };

    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width === w && canvas.height === h) return;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u.res, w, h);
    };

    const draw = (time: number) => {
        gl.uniform1f(u.time, time / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        if (now - last < FRAME_MS) return;
        last = now;
        resize();
        draw(now);
    };

    const start = () => {
        if (!alive || still || raf) return;
        raf = requestAnimationFrame(loop);
    };
    const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
    };

    // Nothing is animating while nobody is looking.
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    // A lost context leaves a blank canvas for good unless it is rebuilt, and
    // on Android that happens for reasons the page cannot control.
    const onLost = (event: Event) => {
        event.preventDefault();
        stop();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    resize();
    pushPalette();
    if (still) draw(0);
    else start();

    return {
        setPalette(next) {
            current = next;
            pushPalette();
            if (still) {
                resize();
                draw(0);
            }
        },
        destroy() {
            alive = false;
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
            canvas.removeEventListener('webglcontextlost', onLost);
        },
    };
};
