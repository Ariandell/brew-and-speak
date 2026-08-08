/**
 * The water the app lives in, drawn on the GPU.
 *
 * No library. It is one full-screen triangle and one fragment shader;
 * three.js would be six hundred kilobytes to do nothing else, and this has to
 * run inside Telegram on a mid-range Android.
 *
 * What produces the look, in order of how much each matters:
 *
 * 1. **Domain warping.** Noise displaced by noise. This is the whole thing -
 *    plain fbm reads as clouds or fog, warped fbm reads as ink in water. The
 *    difference between the two is one extra sampling step.
 * 2. **A colour ramp, not a gradient.** Colour is looked up along a curve by
 *    the noise value instead of being mixed linearly, and the stops overlap.
 *    That is where the painted edges come from.
 * 3. **Grain.** A smooth gradient on an 8-bit display bands into visible
 *    stripes. Noise per pixel breaks the steps and reads as photographic.
 * 4. **Bubbles in two layers.** Far ones small and slow, near ones large and
 *    quick. The parallax between them is what gives the space depth; no
 *    gradient can do that.
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
uniform vec3  uC0;
uniform vec3  uC1;
uniform vec3  uC2;
uniform vec3  uC3;
uniform vec3  uBubbleTint;
uniform float uFlow;
uniform float uBubbles;
uniform float uGrain;

/* No sin() in the hash. On mobile GPUs the transcendental is the expensive
   part, and this is called well over a hundred times per pixel. */
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

/* Four octaves, not six. The fifth and sixth are below the grain and cost as
   much as everything above them. */
float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.03 + 7.1;
        a *= 0.5;
    }
    return v;
}

/* The field that displaces the other field. It is low frequency by its nature
   and gets multiplied by three before use, so the fine octaves it would carry
   are invisible - and it is sampled twice per pixel, so they are not cheap. */
float fbmCoarse(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p = p * 2.03 + 7.1;
        a *= 0.5;
    }
    return v;
}

/* Overlapping smoothsteps rather than even mixing: the ranges cross, so the
   stops meet in soft bands instead of a straight fade. */
vec3 ramp(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(uC0, uC1, smoothstep(0.00, 0.38, t));
    c = mix(c, uC2, smoothstep(0.34, 0.70, t));
    c = mix(c, uC3, smoothstep(0.66, 1.00, t));
    return c;
}

/* One cell of the grid holds at most one bubble. Presence is a multiply, not
   a branch - a GPU runs both sides of a conditional anyway, so branching here
   buys nothing. */
float bubbleLayer(vec2 p, float scale, float rise, float seed, out float glint) {
    glint = 0.0;
    vec2 gp = p * scale + vec2(0.0, -uTime * rise);

    /* The sway is applied to the whole grid, not to each bubble. Per-bubble it
       cost one sine for every one of the nine cells sampled per pixel, which
       was the most expensive thing in the shader - and a shared wave reads
       better anyway, as a current rather than as nine independent wobbles. */
    gp.x += 0.10 * sin(uTime * 0.55 + gp.y * 1.7 + seed);

    vec2 id = floor(gp);
    vec2 f = fract(gp);

    /* One cell, not the nine around it. A bubble is kept small enough and
       centred far enough from the edges that it can never reach into a
       neighbour, so the neighbours have nothing to contribute - and sampling
       them was costing nine times the work for nothing. */
    float h = hash21(id + seed);
    float present = step(0.60, h);

    vec2 c = vec2(0.28 + 0.44 * hash21(id + 3.7), 0.28 + 0.44 * hash21(id + 9.1));
    float r = 0.08 + 0.12 * hash21(id + 17.3);
    float d = length(f - c);

    /* A bubble is a rim, not a disc. */
    float rim = smoothstep(r, r * 0.86, d) - smoothstep(r * 0.83, r * 0.55, d);

    /* The light caught on its upper left. */
    glint = smoothstep(r * 0.30, 0.0, length(f - c + vec2(r * 0.30, -r * 0.30))) * present;

    return rim * present;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * uFlow;

    vec2 q = vec2(
        fbmCoarse(p * 1.6 + vec2(0.0, t * 0.35)),
        fbmCoarse(p * 1.6 + vec2(5.2, 1.3) - vec2(t * 0.25, 0.0))
    );
    float f = fbm(p * 1.9 + 3.2 * q + vec2(1.7, 9.2));

    vec3 col = ramp(f * 1.12 + 0.07 * (q.x - q.y));

    /* Where the warp is strongest the water is thinnest - pull those places
       toward the top of the ramp so the swirl has light in it. */
    col = mix(col, uC3, clamp(dot(q, q) * 0.55, 0.0, 0.42));

    float glintFar;
    float glintNear;
    float far = bubbleLayer(p, 5.2, 0.055, 1.0, glintFar);
    float near = bubbleLayer(p, 2.5, 0.105, 41.0, glintNear);

    col = mix(col, uBubbleTint, clamp(far * 0.14 + near * 0.28, 0.0, 1.0) * uBubbles);
    col += (glintFar * 0.06 + glintNear * 0.16) * uBubbles;

    float vig = 1.0 - smoothstep(0.35, 1.15, length(uv - 0.5) * 1.25);
    col *= mix(0.80, 1.0, vig);

    col += (hash21(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) * uGrain;

    gl_FragColor = vec4(col, 1.0);
}
`;

type Vec3 = [number, number, number];

export interface Palette {
    /** Dark to light. Colour is read along this, not mixed between two ends. */
    ramp: [Vec3, Vec3, Vec3, Vec3];
    bubbleTint: Vec3;
    /** How fast the water moves. Slower than instinct says. */
    flow: number;
    /** 0 turns the bubbles off entirely. */
    bubbles: number;
    grain: number;
}

export interface Background {
    setPalette(palette: Palette): void;
    /** Frames per second over the last second, for judging by measurement. */
    fps(): number;
    destroy(): void;
}

/** Above this the extra pixels cost real frames and buy nothing on a phone. */
const MAX_DPR = 1.25;
/**
 * The water is low frequency, so it survives being drawn small and scaled up -
 * and the softening helps rather than hurts. Grain grows with it, which reads
 * as film grain instead of pixel noise.
 */
const RENDER_SCALE = 0.8;
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
    // seam down the diagonal where the halves would meet.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const at = (name: string) => gl.getUniformLocation(program, name);
    const u = {
        res: at('uRes'),
        time: at('uTime'),
        c0: at('uC0'),
        c1: at('uC1'),
        c2: at('uC2'),
        c3: at('uC3'),
        bubbleTint: at('uBubbleTint'),
        flow: at('uFlow'),
        bubbles: at('uBubbles'),
        grain: at('uGrain'),
    };

    let current = palette;
    let raf = 0;
    let last = 0;
    let alive = true;
    let frames = 0;
    let windowStart = 0;
    let measured = 0;

    const pushPalette = () => {
        gl.uniform3fv(u.c0, current.ramp[0]);
        gl.uniform3fv(u.c1, current.ramp[1]);
        gl.uniform3fv(u.c2, current.ramp[2]);
        gl.uniform3fv(u.c3, current.ramp[3]);
        gl.uniform3fv(u.bubbleTint, current.bubbleTint);
        gl.uniform1f(u.flow, current.flow);
        gl.uniform1f(u.bubbles, current.bubbles);
        gl.uniform1f(u.grain, current.grain);
    };

    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * RENDER_SCALE;
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

        frames++;
        if (now - windowStart >= 1000) {
            measured = Math.round((frames * 1000) / (now - windowStart));
            frames = 0;
            windowStart = now;
        }
    };

    const start = () => {
        if (!alive || still || raf) return;
        windowStart = performance.now();
        frames = 0;
        raf = requestAnimationFrame(loop);
    };
    const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
    };

    // Nothing animates while nobody is looking.
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
        fps: () => measured,
        destroy() {
            alive = false;
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
            canvas.removeEventListener('webglcontextlost', onLost);
        },
    };
};
