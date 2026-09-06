/** Strict decoder for the offline-prepared mascot; safe before GPU allocation. */
export function decodeMesh(buffer: ArrayBuffer) {
    if (buffer.byteLength < 16) throw new Error('Truncated mesh header');
    const view = new DataView(buffer);
    const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
    if (magic !== 'MSH1' && magic !== 'MSH2') throw new Error('Unsupported mesh format');
    const vertices = view.getUint32(4, true), count = view.getUint32(8, true);
    if (!vertices || vertices > 65535 || !count || count % 3 || count > 600000) throw new Error('Invalid mesh counts');
    const header = magic === 'MSH2' ? 40 : 16;
    const indexAt = magic === 'MSH2' ? (header + vertices * 10 + 3) & ~3 : header + vertices * 9 + (4 - vertices * 3 % 4) % 4;
    if (buffer.byteLength !== indexAt + count * 2) throw new Error('Invalid mesh length');
    const calibration = magic === 'MSH2' ? Array.from({length: 6}, (_, i) => view.getFloat32(16 + i * 4, true)) : [-.63, .48, .67, 1, 0, 0];
    if (calibration.some(n => !Number.isFinite(n)) || calibration[3] <= 0) throw new Error('Invalid mesh calibration');
    const indices = new Uint16Array(buffer, indexAt, count);
    if (indices.some(index => index >= vertices)) throw new Error('Mesh index outside vertex buffer');
    return {
        positions: new Int16Array(buffer, header, vertices * 3),
        normals: new Int8Array(buffer, header + vertices * 6, vertices * 3),
        arms: magic === 'MSH2' ? new Uint8Array(buffer, header + vertices * 9, vertices) : new Uint8Array(vertices),
        indices, calibration,
    };
}
