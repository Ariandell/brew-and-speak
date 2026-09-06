import { readFile } from 'node:fs/promises';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

for (const pose of ['neutral', 'wave', 'present', 'celebrate', 'wait']) {
  const file = await readFile(`src/lab/emotion/assets/pose_${pose}.glb`);
  const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(gltf.scene);
  console.log(pose, 'bounds', box.min.toArray(), box.max.toArray());
  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    console.log('mesh', position.count, 'triangles', (index?.count ?? position.count) / 3, 'matrix', object.matrixWorld.elements);
    const parents = Array.from({ length: position.count }, (_, i) => i);
    const root = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const a = index ? index.getX(i) : i;
      const b = index ? index.getX(i + 1) : i + 1;
      const c = index ? index.getX(i + 2) : i + 2;
      parents[root(b)] = root(a); parents[root(c)] = root(a);
    }
    const parts = new Map<number, { count: number; box: Box3 }>();
    const point = new Vector3();
    for (let i = 0; i < position.count; i++) {
      const key = root(i); const part = parts.get(key) ?? { count: 0, box: new Box3() };
      part.count++; part.box.expandByPoint(point.fromBufferAttribute(position, i)); parts.set(key, part);
    }
    console.log([...parts.values()].sort((a,b) => b.count-a.count).slice(0,12).map(part => ({ count: part.count, min: part.box.min.toArray(), max: part.box.max.toArray() })));
  });
}
