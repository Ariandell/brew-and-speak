/**
 * Just enough matrix maths for one object in front of one camera.
 *
 * Written out rather than pulled in: gl-matrix is a fine library and this uses
 * four of its functions, none of which are hard. Column-major, like WebGL
 * wants, so the arrays go straight into `uniformMatrix4fv` untouched.
 */
export type Mat4 = Float32Array;

export const identity = (): Mat4 =>
    new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export const perspective = (fovY: number, aspect: number, near: number, far: number): Mat4 => {
    const f = 1 / Math.tan(fovY / 2);
    const range = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * range, -1,
        0, 0, near * far * range * 2, 0,
    ]);
};

export const multiply = (a: Mat4, b: Mat4): Mat4 => {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
            out[c * 4 + r] = sum;
        }
    }
    return out;
};

/** Rotation, then scale, then translation - the order an object expects. */
export const compose = (
    tx: number, ty: number, tz: number,
    yaw: number, pitch: number,
    scale: number,
): Mat4 => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);

    // Ry * Rx
    const m00 = cy, m01 = sy * sp, m02 = sy * cp;
    const m10 = 0, m11 = cp, m12 = -sp;
    const m20 = -sy, m21 = cy * sp, m22 = cy * cp;

    return new Float32Array([
        m00 * scale, m10 * scale, m20 * scale, 0,
        m01 * scale, m11 * scale, m21 * scale, 0,
        m02 * scale, m12 * scale, m22 * scale, 0,
        tx, ty, tz, 1,
    ]);
};
