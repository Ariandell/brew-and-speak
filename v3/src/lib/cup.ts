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

/* The face, as numbers rather than as a picture. Everything is in units of
   half the distance between the eyes, measured off the reference artwork. */
uniform float uFaceUnit;
uniform float uFaceY;
uniform vec2 uEye;        // radii, x and y
uniform float uEyeSep;    // half the distance between centres
uniform vec4 uMouth;      // vertex height, half width, sag, half thickness

varying vec3 vNormal;
varying vec3 vLocal;

/* Read off the model's own silhouette, taken along a narrow strip down the
   front so the arms stay out of it. A median over the whole slice buries the
   sleeve's lip - it is a thin ring, and the wall behind it outvotes it. */
const float SLEEVE_BOTTOM = -0.63;
const float SLEEVE_TOP = 0.48;
const float LID_EDGE = 0.67;

/* Roughly where the sleeve's wall sits. Using one radius rather than the true
   one per point keeps the face the same size top to bottom, which a tapering
   cup would otherwise stretch. */
const float SLEEVE_RADIUS = 0.60;

/* Softness of every edge, in face units. Wide enough to hide the pixel grid,
   narrow enough that the eyes stay eyes. */
const float EDGE = 0.013;

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

    /* The face is drawn, not sampled. Two ellipses and an arc are exactly what
       it is, and a traced bitmap of them can only ever be a blurry, ragged
       copy - the eyes in the reference are twenty pixels across and end up two
       hundred on screen. Drawn, they are clean at any size, cost nothing to
       download, and the mood becomes a handful of numbers that can be moved
       rather than a file that can only be swapped. */
    float radius = max(length(vLocal.xz), 0.0001);
    float front = vLocal.z / radius;

    /* Arc length along the surface, so nothing is stretched: the horizontal is
       real distance round the cylinder, not an angle. */
    vec2 f = vec2(atan(vLocal.x, vLocal.z) * SLEEVE_RADIUS, vLocal.y - uFaceY) / uFaceUnit;

    vec2 eye = vec2(abs(f.x) - uEyeSep, f.y) / uEye;
    float ink = 1.0 - smoothstep(1.0 - EDGE / uEye.x, 1.0 + EDGE / uEye.x, length(eye));

    /* The mouth is described by how deeply it sags rather than by a radius and
       a flag for which way up it is. A flag cannot be interpolated - halfway
       between a smile and a frown there is no such thing as half a flag - but a
       signed sag passes through zero, and zero is a straight line, which is a
       real expression in its own right. Everything about a mood can then be
       moved rather than switched. */
    float vertexY = uMouth.x;
    float halfWidth = uMouth.y;
    float sag = uMouth.z;
    float thick = uMouth.w;

    /* Away from zero, or the radius runs off to infinity. At four thousandths
       the arc is already straight to the eye. */
    float s = sag >= 0.0 ? max(sag, 0.004) : min(sag, -0.004);
    float bend = sign(s);

    /* The sagitta relation: a chord of this width with this much sag lies on a
       circle of exactly this radius. */
    float R = (halfWidth * halfWidth + s * s) / (2.0 * abs(s));
    vec2 centre = vec2(0.0, vertexY + bend * R);
    float halfSpan = asin(clamp(halfWidth / R, 0.0, 1.0));

    vec2 d = f - centre;
    float along = atan(d.x, -bend * d.y);
    float toStroke;
    if (abs(along) <= halfSpan) {
        toStroke = abs(length(d) - R);
    } else {
        /* Round caps: past the ends of the span, the nearest point of the
           stroke is its endpoint. Without this the mouth finishes in a
           square-cut edge that reads as a mistake. */
        vec2 cap = centre + R * vec2(sign(d.x) * sin(halfSpan), -bend * cos(halfSpan));
        toStroke = length(f - cap);
    }
    ink = max(ink, 1.0 - smoothstep(thick - EDGE, thick + EDGE, toStroke));

    /* Fading by how far round the cylinder the surface has turned stops the
       face smearing down the sides, which is what any projection does at
       grazing angles. */
    albedo = mix(albedo, uFaceInk, ink * smoothstep(0.20, 0.55, front) * sleeve);

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

/**
 * A mood, as geometry. Measured off the reference in units of half the
 * distance between the eyes, which is the one length everything else on a face
 * is naturally described against.
 */
export interface FaceShape {
    /** How large that unit is in model units - the size of the whole face. */
    unit: number;
    /** Height of the eye line on the sleeve. */
    centreY: number;
    eyeRadius: [number, number];
    eyeSeparation: number;
    /** Vertex height, half width, sag, half thickness. Sag is signed: positive
     *  curves up into a smile, negative down into a frown, zero is a line. */
    mouth: [number, number, number, number];
}

/**
 * Where the cup is and where it is looking.
 *
 * Position is in screen units - the middle is zero, the top edge is one - so a
 * screen says where it wants the cup without knowing anything about the lens.
 */
export interface CupPose {
    x: number;
    y: number;
    /** Multiplies the base size. */
    scale: number;
    /** Added to the idle drift, so the cup turns without stopping breathing. */
    lookYaw: number;
    lookPitch: number;
}

export const RESTING: CupPose = { x: 0, y: 0, scale: 1, lookYaw: 0, lookPitch: 0 };

export const HAPPY: FaceShape = {
    /* Sized from the reference rather than by eye: there the face is 0.417 of
       the sleeve's height across, and the sleeve here is 1.11 tall. */
    unit: 0.351,
    /* Also from the reference: the eye line sits 0.42 of the way down the
       sleeve, not in the middle of it. */
    centreY: 0.014,
    eyeRadius: [0.160, 0.165],
    eyeSeparation: 0.5,
    /* The same curve the reference has, restated as sag: its arc of radius
       0.465 over a half-span of 0.879 is a chord 0.358 wide sagging 0.169. */
    mouth: [-0.5, 0.358, 0.169, 0.03],
};

/** Eyes wide, mouth a deep small round - the shape of having just noticed. */
export const SURPRISED: FaceShape = {
    ...HAPPY,
    eyeRadius: [0.205, 0.215],
    mouth: [-0.42, 0.2, 0.19, 0.035],
};

/** The same face with the sag on the other side of zero. */
export const SAD: FaceShape = {
    ...HAPPY,
    eyeRadius: [0.15, 0.132],
    mouth: [-0.28, 0.34, -0.13, 0.028],
};

export const MOODS = { happy: HAPPY, surprised: SURPRISED, sad: SAD };
export type Mood = keyof typeof MOODS;

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

export interface CupPass {
    draw(
        mesh: CupMesh,
        face: FaceShape,
        time: number,
        aspect: number,
        colours: CupColours,
        pose: CupPose,
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
        faceUnit: at('uFaceUnit'),
        faceY: at('uFaceY'),
        eye: at('uEye'),
        eyeSep: at('uEyeSep'),
        mouth: at('uMouth'),
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
        draw(mesh, face, time, aspect, colours, pose) {
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

            /* Screen units into world units: the visible half-height at the
               cup's distance is one, and width follows the aspect. */
            const size = scale * pose.scale;
            gl.uniformMatrix4fv(
                u.model,
                false,
                compose(
                    pose.x * visibleHalfHeight * aspect,
                    pose.y * visibleHalfHeight + bob * size,
                    0,
                    yaw + pose.lookYaw,
                    pitch + pose.lookPitch,
                    size,
                ),
            );
            gl.uniform3fv(u.lid, colours.lid);
            gl.uniform3fv(u.body, colours.body);
            gl.uniform3fv(u.sleeveTop, colours.sleeveTop);
            gl.uniform3fv(u.sleeveBottom, colours.sleeveBottom);
            gl.uniform3fv(u.faceInk, colours.faceInk);
            gl.uniform3fv(u.shade, colours.shade);
            gl.uniform3fv(u.rim, colours.rim);
            gl.uniform1f(u.depthTint, colours.depthTint);

            gl.uniform1f(u.faceUnit, face.unit);
            gl.uniform1f(u.faceY, face.centreY);
            gl.uniform2fv(u.eye, face.eyeRadius);
            gl.uniform1f(u.eyeSep, face.eyeSeparation);
            gl.uniform4fv(u.mouth, face.mouth);

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
