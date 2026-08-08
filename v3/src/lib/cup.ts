import { compose, multiply, perspective, type Mat4 } from './mat4';

/**
 * The object at the centre of attention, drawn into the same canvas as the
 * water so that later it can be lit by it and refract it.
 *
 * Nothing about its appearance is baked. The material is analytic - no matcap
 * photograph - and the face is an alpha mask rather than a picture, so even
 * the ink it is drawn in comes from the theme. Recolouring the app recolours
 * the character, down to its eyes, with no asset to re-export.
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

uniform vec3 uLid;
uniform vec3 uBody;
uniform vec3 uSleeveTop;
uniform vec3 uSleeveBottom;
uniform vec3 uFaceInk;
uniform vec3 uShade;
uniform vec3 uRim;
uniform float uDepthTint;
uniform sampler2D uFace;
uniform float uFaceOn;

varying vec3 vNormal;
varying vec3 vLocal;

/* Read off the model's own radius profile, then checked against a ruler drawn
   on the mesh - the profile alone put the sleeve's top a tenth too low. */
const float SLEEVE_BOTTOM = -0.575;
const float SLEEVE_TOP = 0.305;
const float LID_EDGE = 0.595;

/* The face is wrapped round the sleeve rather than mapped through texture
   coordinates: the sleeve is a cylinder, so the angle about the axis is the
   horizontal and the height is the vertical. No UVs on the model at all. */
const float FACE_ARC = 1.15;
const float FACE_CENTRE_Y = -0.08;
const float FACE_HALF_HEIGHT = 0.357;

void main() {
    vec3 n = normalize(vNormal);

    float sleeve = smoothstep(SLEEVE_BOTTOM - 0.025, SLEEVE_BOTTOM + 0.025, vLocal.y)
                 * (1.0 - smoothstep(SLEEVE_TOP - 0.025, SLEEVE_TOP + 0.025, vLocal.y));
    float lid = smoothstep(LID_EDGE - 0.025, LID_EDGE + 0.025, vLocal.y);

    /* The reference sleeve is bluer at the top and pinker at the bottom. Most
       of what looks like a gradient there is the light, which this already
       does - this is only the part the light cannot explain. */
    float band = clamp((vLocal.y - SLEEVE_BOTTOM) / (SLEEVE_TOP - SLEEVE_BOTTOM), 0.0, 1.0);
    vec3 albedo = mix(uBody, mix(uSleeveBottom, uSleeveTop, band), sleeve);
    albedo = mix(albedo, uLid, lid);

    float radius = max(length(vLocal.xz), 0.0001);
    float front = vLocal.z / radius;
    float u = 0.5 + atan(vLocal.x, vLocal.z) / FACE_ARC;
    float v = 0.5 - (vLocal.y - FACE_CENTRE_Y) / (2.0 * FACE_HALF_HEIGHT);
    float inside = step(0.0, u) * step(u, 1.0) * step(0.0, v) * step(v, 1.0);

    /* Fading by how far round the cylinder the surface has turned keeps the
       decal from smearing down the sides, which is what a flat projection does
       at grazing angles. */
    float face = texture2D(uFace, vec2(u, v)).a
               * inside * smoothstep(0.20, 0.55, front) * sleeve * uFaceOn;
    albedo = mix(albedo, uFaceInk, face);

    /* Wrapped diffuse rather than a plain dot product: light bleeds a little
       past the terminator, which is what soft matte plastic does and what the
       hard falloff of a straight lambert never looks like. */
    vec3 key = normalize(vec3(-0.42, 0.70, 0.58));
    float wrap = clamp((dot(n, key) + 0.42) / 1.42, 0.0, 1.0);
    vec3 col = albedo * (0.50 + 0.62 * wrap);

    /* The sheen tints with the surface. A white highlight on a coloured body
       is exactly what makes plastic read as cheap plastic. */
    col += albedo * pow(max(dot(n, key), 0.0), 3.0) * 0.20;

    /* Rim: where the surface turns out of sight is where light wraps around a
       body under water. */
    col += uRim * pow(1.0 - max(n.z, 0.0), 3.5) * 0.55;

    /* What sits deeper has more water in front of it. Cheap, and it seats the
       object in the scene instead of on top of it. */
    col = mix(col, uShade, clamp((0.30 - vLocal.y) * uDepthTint, 0.0, 0.40));

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

type Vec3 = [number, number, number];

export interface CupColours {
    lid: Vec3;
    body: Vec3;
    sleeveTop: Vec3;
    sleeveBottom: Vec3;
    /** The eyes and mouth. Tinted from the theme - the mask carries no colour. */
    faceInk: Vec3;
    /** The water's own colour, mixed into whatever sits deeper. */
    shade: Vec3;
    rim: Vec3;
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

/**
 * The face, as coverage only: white with an alpha channel. The shader decides
 * what colour it is, which is what lets one mask serve every theme - and what
 * will let a mood be swapped by loading a different four-kilobyte file.
 */
export const loadFace = (gl: WebGLRenderingContext, url: string): Promise<WebGLTexture | null> =>
    new Promise(resolve => {
        const image = new Image();
        image.onload = () => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // Clamped, or wrapping round the cylinder repeats the eyes onto
            // the back of the cup.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            resolve(texture);
        };
        image.onerror = () => {
            console.error('Обличчя не завантажилось:', url);
            resolve(null);
        };
        image.src = url;
    });

export interface CupPass {
    draw(
        mesh: CupMesh,
        face: WebGLTexture | null,
        time: number,
        aspect: number,
        colours: CupColours,
    ): void;
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
        lid: at('uLid'),
        body: at('uBody'),
        sleeveTop: at('uSleeveTop'),
        sleeveBottom: at('uSleeveBottom'),
        faceInk: at('uFaceInk'),
        shade: at('uShade'),
        rim: at('uRim'),
        depthTint: at('uDepthTint'),
        face: at('uFace'),
        faceOn: at('uFaceOn'),
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
        draw(mesh, face, time, aspect, colours) {
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

            /* Idle drift. Periods that do not divide into each other, so the
               loop never lands on itself and the motion reads as floating
               rather than as an animation playing. */
            const bob = Math.sin(time * 0.44) * 0.06 + Math.sin(time * 0.27) * 0.03;
            const yaw = Math.sin(time * 0.21) * 0.30;
            const pitch = Math.sin(time * 0.33) * 0.07;

            gl.uniformMatrix4fv(u.model, false, compose(0, bob * scale, 0, yaw, pitch, scale));
            gl.uniform3fv(u.lid, colours.lid);
            gl.uniform3fv(u.body, colours.body);
            gl.uniform3fv(u.sleeveTop, colours.sleeveTop);
            gl.uniform3fv(u.sleeveBottom, colours.sleeveBottom);
            gl.uniform3fv(u.faceInk, colours.faceInk);
            gl.uniform3fv(u.shade, colours.shade);
            gl.uniform3fv(u.rim, colours.rim);
            gl.uniform1f(u.depthTint, colours.depthTint);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, face);
            gl.uniform1i(u.face, 1);
            gl.uniform1f(u.faceOn, face ? 1 : 0);

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
