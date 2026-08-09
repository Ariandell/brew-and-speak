import { createCupPass, HAPPY, loadCup, RESTING, type CupColours, type CupMesh, type CupPose } from './cup';

/**
 * The space the app lives in: water, bubbles, and the cup floating in it.
 *
 * No library. three.js would be six hundred kilobytes to do nothing more than
 * this, and it has to run inside Telegram on a mid-range Android.
 *
 * The frame is drawn in two resolutions, which is the whole reason this is
 * built the way it is:
 *
 *   water  -> a small offscreen texture, then stretched up
 *   cup    -> straight to the screen at full size, with multisampling
 *
 * The water is low frequency and survives being drawn small; softening it
 * costs nothing and saves most of the fill rate. The cup does not - a silhouette
 * drawn small and stretched is exactly the staircase edge that reads as cheap.
 * Keeping them in one canvas rather than two is what will later let the cup
 * refract the water, which needs the water available as a texture anyway.
 *
 * What produces the look of the water, in order of how much each matters:
 *
 * 1. **Domain warping.** Noise displaced by noise. Plain fbm reads as clouds;
 *    warped fbm reads as ink in water. One extra sampling step between them.
 * 2. **A colour ramp, not a gradient.** Colour is read along a curve by the
 *    noise value and the stops overlap, which is where the painted edges are.
 * 3. **Grain**, applied at full resolution in the upscale. A smooth gradient
 *    on an 8-bit display bands into stripes; noise per pixel breaks them.
 * 4. **Bubbles in two layers.** The parallax between near and far is what
 *    gives the space depth, and no gradient can do that.
 *
 * GLSL ES 1.0 on purpose: WebGL2 is not everywhere inside older Android
 * WebViews, and nothing here needs it.
 */

const FULLSCREEN_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const WATER_FRAG = `
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
uniform vec3  uRipple;   // where it started, and when

/* No sin() in the hash. On mobile GPUs the transcendental is the expensive
   part, and this is called around fifty times per pixel. */
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

/* Four octaves, not six. The fifth and sixth sit below the grain and cost as
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

/* The field that displaces the other field. Low frequency by nature, and
   multiplied by three before use, so its fine octaves are invisible - and it
   is sampled twice per pixel, so they are not cheap. */
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

/* One cell of the grid holds at most one bubble, and only that cell is
   sampled: the bubble is kept small enough and centred far enough from the
   edges that it can never reach a neighbour, so the eight around it have
   nothing to contribute. Presence is a multiply, not a branch - a GPU runs
   both sides of a conditional anyway. */
float bubbleLayer(vec2 p, float scale, float rise, float seed, out float glint) {
    vec2 gp = p * scale + vec2(0.0, -uTime * rise);

    /* The sway moves the whole grid, not each bubble: per bubble it cost a
       sine per cell, and a shared wave reads better anyway - as a current
       rather than as independent wobbles. */
    gp.x += 0.10 * sin(uTime * 0.55 + gp.y * 1.7 + seed);

    vec2 id = floor(gp);
    vec2 f = fract(gp);

    float h = hash21(id + seed);
    float present = step(0.60, h);

    vec2 c = vec2(0.28 + 0.44 * hash21(id + 3.7), 0.28 + 0.44 * hash21(id + 9.1));
    float r = 0.08 + 0.12 * hash21(id + 17.3);
    float d = length(f - c);

    /* A bubble is a rim, not a disc. */
    float rim = smoothstep(r, r * 0.86, d) - smoothstep(r * 0.83, r * 0.55, d);
    glint = smoothstep(r * 0.30, 0.0, length(f - c + vec2(r * 0.30, -r * 0.30))) * present;

    return rim * present;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * uFlow;

    /* A ring spreading from where the screen was touched. It does two things,
       and the first matters more: it *displaces* where the water is sampled,
       so the pattern itself bends, rather than a bright circle being drawn on
       top of an undisturbed surface. */
    float ripple = 0.0;
    float age = uTime - uRipple.z;
    if (uRipple.z > 0.0 && age > 0.0 && age < 2.4) {
        vec2 away = p - uRipple.xy;
        float reach = length(away);
        float band = exp(-abs(reach - age * 0.52) * 11.0);
        ripple = band * (1.0 - age / 2.4);
        p += normalize(away + vec2(0.0001)) * ripple * 0.07;
    }

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

    col += uBubbleTint * ripple * 0.13;

    float vig = 1.0 - smoothstep(0.35, 1.15, length(uv - 0.5) * 1.25);
    col *= mix(0.80, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
}
`;

const UPSCALE_FRAG = `
precision mediump float;

uniform sampler2D uWater;
uniform float uTime;
uniform float uGrain;

varying vec2 vUv;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec3 col = texture2D(uWater, vUv).rgb;
    /* Grain belongs here rather than in the water: applied before the stretch
       it would be blurred into mush, and it is the one thing that has to stay
       at the size of a real pixel. */
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

export interface SceneLook {
    palette: Palette;
    cup: CupColours;
}

export interface Scene {
    setLook(look: SceneLook): void;
    /** Where the cup should be. It swims there rather than jumping. */
    setPose(pose: Partial<CupPose>): void;
    /** A touch, in fractions of the canvas, origin at its top left. */
    touch(x: number, y: number): void;
    /** Frames per second over the last second, for judging by measurement. */
    fps(): number;
    /** Which rung of the quality ladder is in use. Zero is full. */
    quality(): number;
    /** What is actually drawing, and at what size. */
    info(): { renderer: string; width: number; height: number };
    destroy(): void;
}

/**
 * The gate is a deadline that advances, not a comparison against the last
 * frame drawn. Comparing is the obvious way and it is wrong: at a target of
 * thirty on a 60Hz screen, two ticks are 33.34ms apart against a 33.33
 * threshold, so the pair only just clears - and the moment a timestamp lands a
 * hair early the frame is skipped and the next chance is the third tick. Every
 * third tick of 60Hz is 20 frames a second. Measured at exactly 20.3 in
 * simulation, which is what sent the quality ladder down a rung on hardware
 * that was never struggling.
 */
const frameMs = (fps: number) => 1000 / fps;

/**
 * What to give up, and in what order, when the frame rate will not hold.
 *
 * Frame rate goes first, before any sharpness. A slow, continuous drift is the
 * worst case for a low rate - panning is exactly where judder shows - but a
 * crisp thirty still reads far better than a soft sixty, so the picture is the
 * last thing to be spent.
 *
 * After that it is resolution, measured rather than guessed: dropping the
 * water's resolution by three quarters bought two frames a second, while
 * turning off multisampling bought seven. Multisampling is not paid at the
 * edges of the cup - it makes every pixel of the screen cost four samples,
 * including the full-screen stretch that has no edges at all.
 *
 * The bubbles stay at every rung. Turning them off was in the first version of
 * this ladder, until the measurement said the whole water pass is not the cost
 * - so removing them would have given up something visible in exchange for
 * almost nothing.
 *
 * It only ever steps down. Climbing back up when the rate recovers makes the
 * quality oscillate, and a picture that keeps changing sharpness is more
 * noticeable than one that is simply softer.
 */
const QUALITY = [
    { fps: 60, dpr: 2, water: 0.55 },
    { fps: 30, dpr: 2, water: 0.55 },
    { fps: 30, dpr: 1.5, water: 0.5 },
    { fps: 30, dpr: 1.15, water: 0.45 },
];
/** A rung comes off below this share of what the rung is asking for. */
const FLOOR = 0.8;

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

const link = (gl: WebGLRenderingContext, vert: WebGLShader, frag: WebGLShader, what: string) => {
    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`Програма «${what}» не злінкувалась:`, gl.getProgramInfoLog(program));
        return null;
    }
    return program;
};

/**
 * Returns null when WebGL is unavailable, so the caller can leave its CSS
 * fallback in place. The scene is decoration - it must never be the reason a
 * screen fails to render.
 */
export const createScene = (
    canvas: HTMLCanvasElement,
    look: SceneLook,
    still: boolean,
    meshUrl?: string,
): Scene | null => {
    const gl = (canvas.getContext('webgl', {
        // Multisampling applies to the default framebuffer only, which is
        // exactly where the cup is drawn and the only place with edges.
        antialias: true,
        alpha: false,
        depth: true,
    }) ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;

    const fullscreenVert = compile(gl, gl.VERTEX_SHADER, FULLSCREEN_VERT);
    const waterFrag = compile(gl, gl.FRAGMENT_SHADER, WATER_FRAG);
    const upscaleFrag = compile(gl, gl.FRAGMENT_SHADER, UPSCALE_FRAG);
    if (!fullscreenVert || !waterFrag || !upscaleFrag) return null;

    const waterProgram = link(gl, fullscreenVert, waterFrag, 'вода');
    const upscaleProgram = link(gl, fullscreenVert, upscaleFrag, 'розтяг');
    if (!waterProgram || !upscaleProgram) return null;

    // One triangle that covers the screen, not two. Fewer vertices, and no
    // seam down the diagonal where the halves would meet.
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const waterU = {
        pos: gl.getAttribLocation(waterProgram, 'aPos'),
        res: gl.getUniformLocation(waterProgram, 'uRes'),
        time: gl.getUniformLocation(waterProgram, 'uTime'),
        c0: gl.getUniformLocation(waterProgram, 'uC0'),
        c1: gl.getUniformLocation(waterProgram, 'uC1'),
        c2: gl.getUniformLocation(waterProgram, 'uC2'),
        c3: gl.getUniformLocation(waterProgram, 'uC3'),
        bubbleTint: gl.getUniformLocation(waterProgram, 'uBubbleTint'),
        flow: gl.getUniformLocation(waterProgram, 'uFlow'),
        bubbles: gl.getUniformLocation(waterProgram, 'uBubbles'),
        ripple: gl.getUniformLocation(waterProgram, 'uRipple'),
    };
    const upscaleU = {
        pos: gl.getAttribLocation(upscaleProgram, 'aPos'),
        water: gl.getUniformLocation(upscaleProgram, 'uWater'),
        time: gl.getUniformLocation(upscaleProgram, 'uTime'),
        grain: gl.getUniformLocation(upscaleProgram, 'uGrain'),
    };

    const waterTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, waterTexture);
    // Linear, so the stretch is a smooth blur rather than visible blocks, and
    // clamped, so the edge pixels do not wrap around to the far side.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const waterTarget = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, waterTarget);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, waterTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    /* Which GPU is really doing this. Chrome falls back to a software
       rasteriser when acceleration is off or the card is blocklisted, and that
       fallback looks exactly like a slow device from the inside - so it has to
       be visible rather than guessed at. */
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));

    const cupPass = createCupPass(gl, (type, source) => compile(gl, type, source));
    let cupMesh: CupMesh | null = null;
    if (meshUrl) {
        // The water must not wait on it. If the model never arrives, or arrives
        // broken, the scene is simply the water - which is a complete thing.
        loadCup(gl, meshUrl).then(mesh => {
            cupMesh = mesh;
        });
    }

    let current = look;

    /* Everything the cup does is a target and a damped value chasing it. That
       is what makes it read as swimming: it never arrives on a schedule, it
       just keeps closing the distance. */
    const wanted: CupPose = { ...RESTING };
    const actual: CupPose = { ...RESTING };
    let ripple: [number, number, number] = [0, 0, -1];

    let raf = 0;
    let due = 0;
    let slow = 0;
    let alive = true;
    let frames = 0;
    let windowStart = 0;
    let measured = 0;
    let width = 0;
    let height = 0;
    let waterWidth = 0;
    let waterHeight = 0;
    let rung = 0;

    /* Reading clientWidth makes the browser settle the layout first. Doing it
       inside the frame loop meant paying for that on every single frame, for a
       number that changes only when the window does. */
    let sizeDirty = true;
    const observer =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => (sizeDirty = true));
    observer?.observe(canvas);

    const resize = () => {
        if (!sizeDirty) return;
        sizeDirty = false;
        const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[rung].dpr);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (width === w && height === h) return;

        width = w;
        height = h;
        canvas.width = w;
        canvas.height = h;

        waterWidth = Math.max(1, Math.round(w * QUALITY[rung].water));
        waterHeight = Math.max(1, Math.round(h * QUALITY[rung].water));
        gl.bindTexture(gl.TEXTURE_2D, waterTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, waterWidth, waterHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    };

    const drawFullscreen = (attribute: number) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const draw = (time: number) => {
        const seconds = time / 1000;

        gl.bindFramebuffer(gl.FRAMEBUFFER, waterTarget);
        gl.viewport(0, 0, waterWidth, waterHeight);
        gl.useProgram(waterProgram);
        gl.uniform2f(waterU.res, waterWidth, waterHeight);
        gl.uniform1f(waterU.time, seconds);
        gl.uniform3fv(waterU.c0, current.palette.ramp[0]);
        gl.uniform3fv(waterU.c1, current.palette.ramp[1]);
        gl.uniform3fv(waterU.c2, current.palette.ramp[2]);
        gl.uniform3fv(waterU.c3, current.palette.ramp[3]);
        gl.uniform3fv(waterU.bubbleTint, current.palette.bubbleTint);
        gl.uniform1f(waterU.flow, current.palette.flow);
        gl.uniform1f(waterU.bubbles, current.palette.bubbles);
        gl.uniform3fv(waterU.ripple, ripple);
        drawFullscreen(waterU.pos);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        gl.useProgram(upscaleProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, waterTexture);
        gl.uniform1i(upscaleU.water, 0);
        gl.uniform1f(upscaleU.time, seconds);
        gl.uniform1f(upscaleU.grain, current.palette.grain);
        drawFullscreen(upscaleU.pos);

        if (cupPass && cupMesh) {
            /* Chase the target. A fixed fraction per frame rather than a
               duration: interrupting it mid-way needs no special case, which a
               timed animation always does. */
            const follow = (from: number, to: number, rate: number) => from + (to - from) * rate;
            actual.x = follow(actual.x, wanted.x, 0.10);
            actual.y = follow(actual.y, wanted.y, 0.10);
            actual.scale = follow(actual.scale, wanted.scale, 0.10);
            actual.lookYaw = follow(actual.lookYaw, wanted.lookYaw, 0.12);
            actual.lookPitch = follow(actual.lookPitch, wanted.lookPitch, 0.12);

            /* Attention fades. Without this the cup stares at the last thing
               touched forever, which stops reading as noticing. */
            wanted.lookYaw *= 0.986;
            wanted.lookPitch *= 0.986;

            // The water wrote no depth, so the buffer has to start clean or the
            // cup tests against whatever was left in it last frame.
            gl.clear(gl.DEPTH_BUFFER_BIT);
            cupPass.draw(cupMesh, HAPPY, seconds, width / height, current.cup, actual);
        }
    };

    const loop = (now: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        if (now < due) return;

        // Advance the deadline rather than resetting it, so the average holds
        // at the target. If it has fallen far behind - a hidden tab, a stall -
        // start again from now instead of drawing a burst to catch up.
        const step = frameMs(QUALITY[rung].fps);
        due = (now - due > step ? now : due) + step;

        resize();
        draw(now);

        frames++;
        if (now - windowStart >= 1000) {
            measured = Math.round((frames * 1000) / (now - windowStart));
            frames = 0;
            windowStart = now;

            // Two bad seconds in a row, not one. A single slow second happens
            // while assets are still arriving, and giving up quality for that
            // is a permanent price for a temporary problem.
            slow = measured < QUALITY[rung].fps * FLOOR ? slow + 1 : 0;
            if (slow >= 2 && rung < QUALITY.length - 1) {
                rung++;
                slow = 0;
                // Force the next resize to rebuild at the new scale.
                width = 0;
                height = 0;
                sizeDirty = true;
            }
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
    if (still) draw(0);
    else start();

    return {
        setLook(next) {
            current = next;
            if (still) {
                resize();
                draw(0);
            }
        },
        setPose(pose) {
            Object.assign(wanted, pose);
        },
        touch(x, y) {
            const aspect = width / Math.max(height, 1);
            // The shader works with the origin at the bottom left, in units
            // where the height is one and the width is the aspect.
            ripple = [x * aspect, 1 - y, performance.now() / 1000];
            wanted.lookYaw = (x - 0.5) * 1.1;
            wanted.lookPitch = (y - 0.5) * 0.45;
        },
        fps: () => measured,
        quality: () => rung,
        info: () => ({ renderer, width, height }),
        destroy() {
            alive = false;
            stop();
            observer?.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            canvas.removeEventListener('webglcontextlost', onLost);
        },
    };
};
