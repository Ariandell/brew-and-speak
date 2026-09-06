import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { EmotionPose } from './types';

type Point = readonly [number, number, number];

interface Capsule {
    from: Point;
    to: Point;
    radius: number;
    feather?: number;
}

/* The generated models deliberately remain untouched. Their single material
   does not identify hands, so each static pose gets a tiny authored 3D paint
   mask. Capsules follow the actual limbs in model space and are independent
   of camera angle, screen size and material band heights. */
const ARM_CAPSULES: Record<EmotionPose, readonly Capsule[]> = {
    neutral: [
        { from: [-0.61, 0.44, 0.03], to: [-0.57, 0.14, 0.09], radius: 0.2, feather: 0.035 },
        { from: [0.61, 0.45, 0.03], to: [0.64, 0.14, 0.08], radius: 0.2, feather: 0.035 },
    ],
    wave: [
        { from: [-0.57, 1.08, 0.0], to: [-0.62, 1.46, 0.0], radius: 0.16 },
        { from: [-0.62, 1.49, 0.0], to: [-0.57, 1.63, 0.0], radius: 0.27, feather: 0.04 },
        { from: [0.67, 0.46, 0.04], to: [0.69, 0.18, 0.08], radius: 0.17 },
    ],
    present: [
        { from: [-0.48, 0.73, 0.0], to: [-0.68, 0.43, 0.0], radius: 0.16 },
        { from: [-0.69, 0.42, 0.0], to: [-0.73, 0.34, 0.0], radius: 0.24, feather: 0.04 },
        { from: [0.69, 0.46, 0.04], to: [0.72, 0.18, 0.08], radius: 0.17 },
    ],
    celebrate: [
        { from: [-0.30, 0.68, 0.48], to: [-0.08, 1.08, 0.68], radius: 0.15 },
        { from: [-0.08, 1.08, 0.70], to: [0.00, 1.36, 0.75], radius: 0.17, feather: 0.025 },
        { from: [-0.15, 1.30, 0.75], to: [-0.15, 1.61, 0.75], radius: 0.075, feather: 0.018 },
        { from: [-0.05, 1.32, 0.77], to: [-0.05, 1.66, 0.77], radius: 0.075, feather: 0.018 },
        { from: [0.05, 1.31, 0.76], to: [0.05, 1.63, 0.76], radius: 0.075, feather: 0.018 },
        { from: [0.15, 1.28, 0.73], to: [0.15, 1.55, 0.73], radius: 0.08, feather: 0.018 },
    ],
    wait: [
        { from: [-0.56, 0.78, 0.08], to: [-0.25, 0.77, 0.39], radius: 0.14 },
        { from: [0.58, 0.78, 0.08], to: [0.25, 0.77, 0.43], radius: 0.14 },
        { from: [-0.28, 0.76, 0.43], to: [0.30, 0.76, 0.52], radius: 0.19, feather: 0.035 },
    ],
};

const start = new Vector3();
const end = new Vector3();
const point = new Vector3();
const segment = new Vector3();
const offset = new Vector3();

const distanceToCapsule = (x: number, y: number, z: number, capsule: Capsule) => {
    start.fromArray(capsule.from);
    end.fromArray(capsule.to);
    point.set(x, y, z);
    segment.subVectors(end, start);
    offset.subVectors(point, start);
    const lengthSquared = Math.max(segment.lengthSq(), 0.000001);
    const along = Math.max(0, Math.min(1, offset.dot(segment) / lengthSquared));
    offset.copy(segment).multiplyScalar(along).add(start);
    return point.distanceTo(offset);
};

export const geometryWithArmMask = (source: BufferGeometry, pose: EmotionPose) => {
    const geometry = source.clone();
    const position = geometry.getAttribute('position');
    const mask = new Float32Array(position.count);

    const index = geometry.getIndex();
    if (!index) {
        geometry.setAttribute('aArmMask', new BufferAttribute(mask, 1));
        return geometry;
    }

    const parent = Int32Array.from({ length: position.count }, (_, vertex) => vertex);
    const find = (vertex: number): number => {
        let root = vertex;
        while (parent[root] !== root) root = parent[root];
        while (parent[vertex] !== vertex) {
            const next = parent[vertex];
            parent[vertex] = root;
            vertex = next;
        }
        return root;
    };
    const join = (left: number, right: number) => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
    };

    for (let triangle = 0; triangle < index.count; triangle += 3) {
        const a = index.getX(triangle);
        const b = index.getX(triangle + 1);
        const c = index.getX(triangle + 2);
        join(a, b);
        join(b, c);
    }

    interface Component {
        vertices: number[];
        min: Vector3;
        max: Vector3;
        centre: Vector3;
    }

    const components = new Map<number, Component>();
    for (let vertex = 0; vertex < position.count; vertex += 1) {
        const root = find(vertex);
        const component = components.get(root) ?? {
            vertices: [],
            min: new Vector3(Infinity, Infinity, Infinity),
            max: new Vector3(-Infinity, -Infinity, -Infinity),
            centre: new Vector3(),
        };
        point.set(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
        component.vertices.push(vertex);
        component.min.min(point);
        component.max.max(point);
        component.centre.add(point);
        components.set(root, component);
    }

    for (const component of components.values()) {
        component.centre.multiplyScalar(1 / component.vertices.length);
        const span = component.max.clone().sub(component.min);
        const maxSpan = Math.max(span.x, span.y, span.z);

        /* Main cup shells and rings span almost the full model. Never allow a
           paint volume that brushes their surface to recolour the whole cup. */
        if (maxSpan >= 0.9) continue;

        const isArm = ARM_CAPSULES[pose].some(capsule => (
            distanceToCapsule(component.centre.x, component.centre.y, component.centre.z, capsule)
                <= capsule.radius + maxSpan * 0.28
        ));
        if (!isArm) continue;
        for (const vertex of component.vertices) mask[vertex] = 1;
    }

    geometry.setAttribute('aArmMask', new BufferAttribute(mask, 1));
    return geometry;
};
