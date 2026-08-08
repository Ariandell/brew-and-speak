/**
 * GLB -> a small binary the app can read without a parser.
 *
 * The exported file carries things we will never use. Tangents exist only for
 * normal maps and cost sixteen bytes a vertex; texture coordinates cost eight
 * and the material is analytic, so nothing samples them. Between them they are
 * more than half the download.
 *
 * What is left is quantised: positions to 16-bit over the model's own bounding
 * box, normals to 8-bit. A cup two units tall lands at roughly a twentieth of
 * a millimetre of precision, which is far below anything the eye can find, and
 * the file drops to under a third of what it was.
 *
 *   node scripts/prepare-model.mjs <in.glb> <out.msh>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
    console.error('Вжиток: node scripts/prepare-model.mjs <in.glb> <out.msh>');
    process.exit(1);
}

const glb = readFileSync(input);
if (glb.toString('ascii', 0, 4) !== 'glTF') {
    console.error('Це не GLB.');
    process.exit(1);
}

let json = null;
let bin = null;
for (let off = 12; off < glb.length; ) {
    const length = glb.readUInt32LE(off);
    const type = glb.readUInt32LE(off + 4);
    const body = glb.subarray(off + 8, off + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    if (type === 0x004e4942) bin = body;
    off += 8 + length;
}

const COMPONENT = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
};
const COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** glTF lets an accessor stride over a shared buffer; walk it rather than assume. */
const read = index => {
    const accessor = json.accessors[index];
    const view = json.bufferViews[accessor.bufferView];
    const Type = COMPONENT[accessor.componentType];
    const parts = COUNT[accessor.type];
    const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? parts * Type.BYTES_PER_ELEMENT;

    const out = new Type(accessor.count * parts);
    for (let i = 0; i < accessor.count; i++) {
        const at = base + i * stride;
        for (let c = 0; c < parts; c++) {
            out[i * parts + c] = new Type(bin.buffer, bin.byteOffset + at + c * Type.BYTES_PER_ELEMENT, 1)[0];
        }
    }
    return out;
};

const primitive = json.meshes[0].primitives[0];
const position = read(primitive.attributes.POSITION);
const normal = read(primitive.attributes.NORMAL);
const rawIndex = read(primitive.indices);
const vertexCount = position.length / 3;

// Centre on the model's own middle. The export put the origin at the base,
// and the cup has to turn about itself, not pivot on its foot.
let minX = Infinity, minY = Infinity, minZ = Infinity;
let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
for (let i = 0; i < vertexCount; i++) {
    const x = position[i * 3], y = position[i * 3 + 1], z = position[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
}
const centre = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
const radius = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2;

const quantPos = new Int16Array(vertexCount * 3);
for (let i = 0; i < vertexCount * 3; i++) {
    const centred = (position[i] - centre[i % 3]) / radius;
    quantPos[i] = Math.max(-32767, Math.min(32767, Math.round(centred * 32767)));
}

const quantNorm = new Int8Array(vertexCount * 3);
for (let i = 0; i < vertexCount; i++) {
    let x = normal[i * 3], y = normal[i * 3 + 1], z = normal[i * 3 + 2];
    const len = Math.hypot(x, y, z) || 1;
    quantNorm[i * 3] = Math.round((x / len) * 127);
    quantNorm[i * 3 + 1] = Math.round((y / len) * 127);
    quantNorm[i * 3 + 2] = Math.round((z / len) * 127);
}

if (vertexCount > 65535) {
    console.error(`Вершин ${vertexCount} — більше за межу 16-бітних індексів. Потрібна простіша модель.`);
    process.exit(1);
}
const index = new Uint16Array(rawIndex.length);
index.set(rawIndex);

// header: magic, vertexCount, indexCount, then three sections back to back.
const header = Buffer.alloc(16);
header.write('MSH1', 0, 'ascii');
header.writeUInt32LE(vertexCount, 4);
header.writeUInt32LE(index.length, 8);
header.writeFloatLE(radius, 12);

const out = Buffer.concat([
    header,
    Buffer.from(quantPos.buffer),
    Buffer.from(quantNorm.buffer),
    // Normals are three bytes a vertex, so the index section can land on an odd
    // address - and a Uint16Array cannot be created over one.
    Buffer.alloc((4 - ((vertexCount * 3) % 4)) % 4),
    Buffer.from(index.buffer),
]);
writeFileSync(output, out);

const kb = n => (n / 1024).toFixed(0);
console.log(`  вершин ${vertexCount}   трикутників ${index.length / 3}`);
console.log(`  габарит ${(maxX - minX).toFixed(2)} x ${(maxY - minY).toFixed(2)} x ${(maxZ - minZ).toFixed(2)}`);
console.log(`  центр зсунуто на ${centre.map(v => v.toFixed(3)).join(', ')}`);
console.log(`  ${kb(glb.length)} КБ  ->  ${kb(out.length)} КБ`);
