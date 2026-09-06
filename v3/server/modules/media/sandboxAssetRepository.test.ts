import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { abortSandboxAssetUpload, cleanupExpiredAssetUploadSessions, createSandboxAssetUploadSession, finalizeSandboxAssetUpload, getOwnedAsset,
  initializeSandboxAssetSchema, SandboxAssetConflictError, SandboxAssetUploadError, uploadSandboxAsset,
  uploadSandboxAssetChunk } from './sandboxAssetRepository.js';

const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const now = '2026-09-06T12:00:00.000Z';

test('sandbox assets enforce MIME, size and content identity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-assets-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxAssetSchema(database);
    const asset = await uploadSandboxAsset(database, { assetId: 'asset-1', mimeType: 'image/png', base64Data: 'aGVsbG8=', createdAt: '2026-08-17T10:00:00.000Z' });
    assert.equal(asset.bytes, 5);
    assert.equal((await uploadSandboxAsset(database, { assetId: 'asset-1', mimeType: 'image/png', base64Data: 'aGVsbG8=', createdAt: '2026-08-17T10:01:00.000Z' })).sha256, asset.sha256);
    await assert.rejects(() => uploadSandboxAsset(database, { assetId: 'asset-1', mimeType: 'image/png', base64Data: 'd29ybGQ=', createdAt: '2026-08-17T10:02:00.000Z' }), SandboxAssetConflictError);
    await assert.rejects(() => uploadSandboxAsset(database, { assetId: 'asset-2', mimeType: 'text/plain', base64Data: 'aA==', createdAt: '2026-08-17T10:03:00.000Z' }), /MIME/);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});

test('chunked upload is sequential, idempotent, owner-bound, verified and abortable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-chunks-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  const session = (uploadId: string, assetId: string, data: Buffer, ownerUserId = 7, checksum = sha(data)) =>
    createSandboxAssetUploadSession(database, { uploadId, assetId, ownerUserId, mimeType: 'image/png', fileName: 'cup.png',
      totalBytes: data.length, sha256: checksum, chunkSize: 2, totalChunks: Math.ceil(data.length / 2), createdAt: now });
  const chunk = (uploadId: string, ownerUserId: number, chunkIndex: number, data: Buffer, checksum = sha(data)) =>
    uploadSandboxAssetChunk(database, { uploadId, ownerUserId, chunkIndex, base64Data: data.toString('base64'), sha256: checksum, now });
  try {
    await initializeSandboxAssetSchema(database);

    const data = Buffer.from('abcde');
    assert.equal((await session('success', 'chunked-asset', data)).nextChunkIndex, 0);
    assert.equal((await session('success', 'chunked-asset', data)).nextChunkIndex, 0, 'session creation is idempotent');
    await assert.rejects(() => chunk('success', 7, 1, data.subarray(2, 4)), (error: unknown) =>
      error instanceof SandboxAssetUploadError && error.code === 'SEQUENCE');
    await assert.rejects(() => finalizeSandboxAssetUpload(database, { uploadId: 'success', ownerUserId: 7, now }),
      (error: unknown) => error instanceof SandboxAssetUploadError && error.code === 'SEQUENCE');
    assert.equal((await chunk('success', 7, 0, data.subarray(0, 2))).nextChunkIndex, 1);
    assert.equal((await chunk('success', 7, 0, data.subarray(0, 2))).nextChunkIndex, 1, 'identical duplicate is idempotent');
    await assert.rejects(() => chunk('success', 7, 0, Buffer.from('zz')), (error: unknown) =>
      error instanceof SandboxAssetUploadError && error.code === 'CONFLICT');
    await assert.rejects(() => chunk('success', 8, 1, data.subarray(2, 4)), (error: unknown) =>
      error instanceof SandboxAssetUploadError && error.code === 'FORBIDDEN');
    await chunk('success', 7, 1, data.subarray(2, 4));
    await chunk('success', 7, 2, data.subarray(4));
    const metadata = await finalizeSandboxAssetUpload(database, { uploadId: 'success', ownerUserId: 7, now });
    assert.deepEqual(metadata, { assetId: 'chunked-asset', mimeType: 'image/png', bytes: data.length, sha256: sha(data) });
    assert.equal((await finalizeSandboxAssetUpload(database, { uploadId: 'success', ownerUserId: 7, now })).sha256, sha(data),
      'finalize is idempotent');
    assert.equal((await getOwnedAsset(database, 'chunked-asset', 7))?.base64Data, data.toString('base64'));

    await assert.rejects(() => createSandboxAssetUploadSession(database, { uploadId: 'too-big', assetId: 'too-big', ownerUserId: 7,
      mimeType: 'image/png', totalBytes: 20 * 1024 * 1024 + 1, sha256: sha('x'), chunkSize: 512 * 1024,
      totalChunks: 41, createdAt: now }), (error: unknown) => error instanceof SandboxAssetUploadError && error.code === 'LIMIT');

    const bad = Buffer.from('wxyz');
    await session('bad-checksum', 'bad-checksum-asset', bad, 7, sha('different'));
    await chunk('bad-checksum', 7, 0, bad.subarray(0, 2));
    await chunk('bad-checksum', 7, 1, bad.subarray(2));
    await assert.rejects(() => finalizeSandboxAssetUpload(database, { uploadId: 'bad-checksum', ownerUserId: 7, now }),
      (error: unknown) => error instanceof SandboxAssetUploadError && error.code === 'CHECKSUM');

    await session('abort-me', 'abort-asset', Buffer.from('ok'));
    await chunk('abort-me', 7, 0, Buffer.from('ok'));
    await abortSandboxAssetUpload(database, { uploadId: 'abort-me', ownerUserId: 7, now });
    await assert.rejects(() => finalizeSandboxAssetUpload(database, { uploadId: 'abort-me', ownerUserId: 7, now }),
      (error: unknown) => error instanceof SandboxAssetUploadError && error.code === 'NOT_FOUND');

    await session('expire-me', 'expire-asset', Buffer.from('ok'));
    assert.equal(await cleanupExpiredAssetUploadSessions(database, '2026-09-06T12:31:00.000Z'), 3,
      'expired active and finalized session metadata are removed while assets remain');
    await assert.rejects(() => finalizeSandboxAssetUpload(database,
      { uploadId: 'expire-me', ownerUserId: 7, now: '2026-09-06T12:31:00.000Z' }),
    (error: unknown) => error instanceof SandboxAssetUploadError && error.code === 'NOT_FOUND');
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
