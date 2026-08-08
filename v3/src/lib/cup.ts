import { compose, multiply, perspective, type Mat4 } from './mat4';

/**
 * The object at the centre of attention, drawn into the same canvas as the
 * water so that later it can be lit by it and refract it.
 *
 * The material is analytic - no matcap texture. A matcap is a photograph of a
 * lit sphere, and everything one can do here is a few dot products against the
 * normal: a vertical gradient for the ambient, one key light, one rim. That
 * costs nothing to download, and it takes its colours from the theme, which a
 * baked image could never do.
 */

const VERT = `
attribute vec3 aPos;
attribute vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uViewProj;

varying vec3 vNormal;
varying vec3 vLocal;

void main() {
    /* No non-uniform scaling anywhere, so the model matrix rotates normals
       correctly on its own and the inverse transpose is not needed. */
    vNormal = normalize(mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNormal);
    vLocal = aPos;
    gl_Position = uViewProj * uModel * vec4(aPos, 1.0);
}
`;

const FRAG = `
precision mediump float;

uniform vec3 uShade;
uniform vec3 uLight;
uniform vec3 uRim;
uniform float uDepthTint;

varying vec3 vNormal;
varying vec3 vLocal;

void main() {
    vec3 n = normalize(vNormal);

    /* Ambient: sky above, water below. The single biggest cue that an object
       is in an environment rather than floating on a flat colour. */
    float up = n.y * 0.5 + 0.5;
    vec3 col = mix(uShade, uLight, smoothstep(0.10, 0.95, up));

    /* One key light, upper left and slightly toward the viewer. */
    float key = max(dot(n, normalize(vec3(-0.45, 0.72, 0.52))), 0.0);
    col += uLight * pow(key, 4.0) * 0.40;

    /* Rim. Facing away from the camera means the surface is turning out of
       sight, which is where light wraps around a body in water. */
    float facing = max(n.z, 0.0);
    col += uRim * pow(1.0 - facing, 3.0) * 0.85;

    /* The deeper part of the object sits in more water, so it takes more of
       the water's colour. Cheap, and it seats the object in the scene. */
    col = mix(col, uShade, clamp((0.35 - vLocal.y) * uDepthTint, 0.0, 0.55));

    gl_FragColor = vec4(col, 1.0);
}
`;

/** Vertical field of view, in radians. A long lens - wide angles make a small
 *  object look like a toy photographed from close up. */
const FOV = 0.62;
/** How far the camera sits back from the middle. */
const CAMERA_Z = 3.4;
/** Share of the visible height the cup takes up. */
const FILL_HEIGHT = 0.55;

export interface CupColours {
    shade: [number, number, number];
    light: [number, number, number];
    rim: [number, number, number];
    depthTint: number;
}

export interface CupMesh {
    position: WebGLBuffer;
    normal: WebGLBuffer;
    index: WebGLBuffer;
    indexCount: number;
}

/**
 * Reads the format `scripts/prepare-model.mjs` writes: positions as 16-bit
 * over the model's own bounds, normals as 8-bit, indices 16-bit. The GPU
 * un-quantises both for free through `normalized` attribute pointers, so
 * nothing is unpacked on the CPU.
 */
export const loadCup = async (gl: WebGLRenderingContext, url: string): Promise<CupMesh | null> => {
    let buffer: ArrayBuffer;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        buffer = await response.arrayBuffer();
    } catch (error) {
        console.error('Модель не завантажилась:', error);
        return null;
    }

    const view = new DataView(buffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== 'MSH1') {
        console.error('Не той формат моделі:', magic);
        return null;
    }

    const vertexCount = view.getUint32(4, true);
    const indexCount = view.getUint32(8, true);

    let at = 16;
    const positions = new Int16Array(buffer, at, vertexCount * 3);
    at += vertexCount * 6;
    const normals = new Int8Array(buffer, at, vertexCount * 3);
    at += vertexCount * 3;
    at += (4 - ((vertexCount * 3) % 4)) % 4;
    const indices = new Uint16Array(buffer, at, indexCount);

    const upload = (data: ArrayBufferView, target: number) => {
        const handle = gl.createBuffer()!;
        gl.bindBuffer(target, handle);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return handle;
    };

    return {
        position: upload(positions, gl.ARRAY_BUFFER),
        normal: upload(normals, gl.ARRAY_BUFFER),
        index: upload(indices, gl.ELEMENT_ARRAY_BUFFER),
        indexCount,
    };
};

export interface CupPass {
    draw(mesh: CupMesh, time: number, aspect: number, colours: CupColours): void;
}

export const createCupPass = (
    gl: WebGLRenderingContext,
    compile: (type: number, source: string) => WebGLShader | null,
): CupPass | null => {
    const vert = compile(gl.VERTEX_SHADER, VERT);
    const frag = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Програма стаканчика не злінкувалась:', gl.getProgramInfoLog(program));
        return null;
    }

    const aPos = gl.getAttribLocation(program, 'aPos');
    const aNormal = gl.getAttribLocation(program, 'aNormal');
    const at = (name: string) => gl.getUniformLocation(program, name);
    const u = {
        model: at('uModel'),
        viewProj: at('uViewProj'),
        shade: at('uShade'),
        light: at('uLight'),
        rim: at('uRim'),
        depthTint: at('uDepthTint'),
    };

    let projection: Mat4 | null = null;
    let projectionAspect = 0;

    /* The model arrives normalised into a unit box, so it already all but
       fills the frame at scale 1. Deriving the scale from the camera instead
       of guessing a number keeps it right if either the lens or the distance
       is ever changed. */
    const visibleHalfHeight = CAMERA_Z * Math.tan(FOV / 2);
    const scale = FILL_HEIGHT * visibleHalfHeight;

    return {
        draw(mesh, time, aspect, colours) {
            gl.useProgram(program);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);

            if (!projection || projectionAspect !== aspect) {
                projection = perspective(FOV, aspect, 0.1, 20);
                projectionAspect = aspect;
            }

            // Camera sits back on +Z looking at the origin. Written as a plain
            // translation rather than a lookAt: there is nothing to look at
            // but the middle.
            const view = compose(0, 0, -CAMERA_Z, 0, 0, 1);
            gl.uniformMatrix4fv(u.viewProj, false, multiply(projection, view));

            /* Idle drift. Two periods that do not divide into each other, so
               the loop never lands on itself and the motion reads as floating
               rather than as an animation playing. */
            const bob = Math.sin(time * 0.44) * 0.06 + Math.sin(time * 0.27) * 0.03;
            const yaw = Math.sin(time * 0.21) * 0.30;
            const pitch = Math.sin(time * 0.33) * 0.07;

            gl.uniformMatrix4fv(u.model, false, compose(0, bob * scale, 0, yaw, pitch, scale));
            gl.uniform3fv(u.shade, colours.shade);
            gl.uniform3fv(u.light, colours.light);
            gl.uniform3fv(u.rim, colours.rim);
            gl.uniform1f(u.depthTint, colours.depthTint);

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.position);
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 3, gl.SHORT, true, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normal);
            gl.enableVertexAttribArray(aNormal);
            gl.vertexAttribPointer(aNormal, 3, gl.BYTE, true, 0, 0);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
            gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);

            gl.disableVertexAttribArray(aPos);
            gl.disableVertexAttribArray(aNormal);
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);
        },
    };
};
