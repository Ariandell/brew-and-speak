import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { geometryWithArmMask } from '../src/lab/emotion/paintMasks';

// Offline preparation only: no glTF parser, Three.js or second canvas in the app.
await mkdir('public/models/poses', { recursive: true });
for (const pose of ['neutral', 'wave', 'present', 'celebrate', 'wait'] as const) {
  const file = await readFile(`src/lab/emotion/assets/pose_${pose}.glb`);
  const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const parts: ReturnType<typeof geometryWithArmMask>[] = [];
  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    if ('isSkinnedMesh' in object) throw new Error('Static pose compiler cannot bake a rig');
    const part = geometryWithArmMask(object.geometry, pose);
    part.applyMatrix4(object.matrixWorld);
    for (const key of Object.keys(part.attributes)) if (!['position', 'normal', 'aArmMask'].includes(key)) part.deleteAttribute(key);
    parts.push(part);
  });
  const geometry = mergeGeometries(parts);
  if (!geometry) throw new Error(`Cannot merge ${pose}`);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const height = box.max.y - box.min.y;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const mask = geometry.getAttribute('aArmMask');
  const indices = geometry.index;
  if (!indices || position.count > 65535) throw new Error('Pose needs indexed geometry with <=65535 vertices');
  // The lid is the stable cup axis; raised hands must not move the face anchor.
  const lidBox = new Box3(); const point = new Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    if (point.y > box.min.y + height * .86) lidBox.expandByPoint(point);
  }
  const centre = lidBox.getCenter(new Vector3()); centre.y = box.min.y + height / 2;
  const radius = Math.max(...box.max.clone().sub(centre).toArray(), ...centre.clone().sub(box.min).toArray());
  const unit = height / 2 / radius;
  const count = position.count;
  const indexAt = (40 + count * 10 + 3) & ~3;
  const output = Buffer.alloc(indexAt + indices.count * 2);
  output.write('MSH2'); output.writeUInt32LE(count, 4); output.writeUInt32LE(indices.count, 8);
  output.writeFloatLE(radius, 12);
  // Same silhouette measurements and face proportions as the reference cup.
  // Crossed arms occupy the lower face area: lift the ink, not the geometry.
  const faceOffset = pose === 'wait' ? .20 * unit : 0;
  [-.63 * unit, .47 * unit, .68 * unit, unit, faceOffset, 0].forEach((v, i) => output.writeFloatLE(v, 16 + i * 4));
  for (let i = 0; i < count; i++) {
    point.fromBufferAttribute(position, i).sub(centre).divideScalar(radius);
    point.toArray().forEach((value, axis) => output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 40 + (i * 3 + axis) * 2));
    point.fromBufferAttribute(normal, i).normalize();
    point.toArray().forEach((value, axis) => output.writeInt8(Math.round(value * 127), 40 + count * 6 + i * 3 + axis));
    output.writeUInt8(Math.round(mask.getX(i) * 255), 40 + count * 9 + i);
  }
  for (let i = 0; i < indices.count; i++) output.writeUInt16LE(indices.getX(i), indexAt + i * 2);
  await writeFile(`public/models/poses/${pose}.msh`, output);
  console.log(`${pose}: ${indices.count / 3} triangles, ${output.length} bytes, axis=${centre.toArray().map(v => v.toFixed(3))}`);
  geometry.dispose(); parts.forEach(part => part.dispose());
}
