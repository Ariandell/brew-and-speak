import { createHash } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';

export type SandboxAssetMetadata = {
  assetId: string;
  mimeType: string;
  bytes: number;
  sha256: string;
};

export class SandboxAssetConflictError extends Error {
  constructor() {
    super('Sandbox asset id already contains different data');
    this.name = 'SandboxAssetConflictError';
  }
}

export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_ASSET_CHUNK_BYTES = 512 * 1024;
export const ASSET_UPLOAD_TTL_MS = 30 * 60 * 1000;

export const sandboxAssetSchemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_assets (
    id TEXT PRIMARY KEY,
    mime_type TEXT NOT NULL,
    data_base64 TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS v3_asset_owners (
    asset_id TEXT PRIMARY KEY REFERENCES v3_assets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    file_name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS v3_asset_upload_sessions (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    owner_user_id INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    total_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    chunk_size INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    next_chunk_index INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'finalized')),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    finalized_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS v3_asset_upload_chunks (
    session_id TEXT NOT NULL REFERENCES v3_asset_upload_sessions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data_base64 TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    PRIMARY KEY(session_id, chunk_index)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_v3_asset_upload_sessions_expiry
    ON v3_asset_upload_sessions(status, expires_at)`,
];

export const initializeSandboxAssetSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(sandboxAssetSchemaStatements);
};

export type SandboxAssetUploadSession = {
  uploadId: string;
  assetId: string;
  expiresAt: string;
  chunkSize: number;
  totalChunks: number;
  nextChunkIndex: number;
  status: 'active' | 'finalized';
};

export class SandboxAssetUploadError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'EXPIRED' | 'SEQUENCE' | 'CONFLICT' | 'CHECKSUM' | 'LIMIT', message: string) {
    super(message);
    this.name = 'SandboxAssetUploadError';
  }
}

const supportedMimeType = (mimeType: string): boolean => {
  const media = /^(image\/(png|jpeg|webp|gif|avif)|audio\/(mpeg|mp4|ogg|wav|webm|x-wav)|video\/(mp4|webm|ogg))$/;
  return media.test(mimeType) || ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mimeType);
};

const decodeCanonicalBase64 = (value: string): Buffer => {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid base64 asset data');
  const buffer = Buffer.from(value, 'base64');
  if (buffer.toString('base64') !== value) throw new Error('Invalid base64 asset data');
  return buffer;
};

const cleanFileName = (value?: string): string => (value ?? 'attachment').replace(/[\x00-\x1f\x7f/\\]/g, '_');

const sessionFromRow = (row: Record<string, unknown>): SandboxAssetUploadSession => ({
  uploadId: String(row.id), assetId: String(row.asset_id), expiresAt: String(row.expires_at),
  chunkSize: Number(row.chunk_size), totalChunks: Number(row.total_chunks),
  nextChunkIndex: Number(row.next_chunk_index), status: String(row.status) as 'active' | 'finalized',
});

const getSessionRow = async (database: SandboxWriteDatabase, uploadId: string) => {
  const result = await database.execute({ sql: 'SELECT * FROM v3_asset_upload_sessions WHERE id = ? LIMIT 1', args: [uploadId] });
  return result.rows[0] as unknown as Record<string, unknown> | undefined;
};

const requireOwnedSession = async (database: SandboxWriteDatabase, uploadId: string, ownerUserId: number, now: string) => {
  const row = await getSessionRow(database, uploadId);
  if (!row) throw new SandboxAssetUploadError('NOT_FOUND', 'Upload session not found');
  if (Number(row.owner_user_id) !== ownerUserId) throw new SandboxAssetUploadError('FORBIDDEN', 'Upload session belongs to another user');
  if (String(row.status) === 'active' && Date.parse(String(row.expires_at)) <= Date.parse(now)) {
    throw new SandboxAssetUploadError('EXPIRED', 'Upload session expired');
  }
  return row;
};

export const cleanupExpiredAssetUploadSessions = async (database: SandboxWriteDatabase, now: string): Promise<number> => {
  const expired = await database.execute({
    sql: 'SELECT id FROM v3_asset_upload_sessions WHERE datetime(expires_at) <= datetime(?)', args: [now],
  });
  if (!expired.rows.length) return 0;
  const ids = expired.rows.map(row => String(row.id));
  await database.batch(ids.flatMap<InStatement>(id => [
    { sql: 'DELETE FROM v3_asset_upload_chunks WHERE session_id = ?', args: [id] },
    { sql: 'DELETE FROM v3_asset_upload_sessions WHERE id = ?', args: [id] },
  ]));
  return ids.length;
};

export const createSandboxAssetUploadSession = async (
  database: SandboxWriteDatabase,
  input: { uploadId: string; assetId: string; ownerUserId: number; mimeType: string; fileName?: string; totalBytes: number;
    sha256: string; chunkSize: number; totalChunks: number; createdAt: string },
): Promise<SandboxAssetUploadSession> => {
  if (!supportedMimeType(input.mimeType)) throw new Error('Unsupported asset MIME type');
  if (input.totalBytes <= 0 || input.totalBytes > MAX_ASSET_BYTES) {
    throw new SandboxAssetUploadError('LIMIT', 'Asset exceeds the 20 MB limit');
  }
  if (input.chunkSize <= 0 || input.chunkSize > MAX_ASSET_CHUNK_BYTES
    || input.totalChunks !== Math.ceil(input.totalBytes / input.chunkSize)) {
    throw new SandboxAssetUploadError('LIMIT', 'Invalid upload chunk plan');
  }
  const expiresAt = new Date(Date.parse(input.createdAt) + ASSET_UPLOAD_TTL_MS).toISOString();
  const existing = await getSessionRow(database, input.uploadId);
  if (existing) {
    const same = Number(existing.owner_user_id) === input.ownerUserId && String(existing.asset_id) === input.assetId
      && String(existing.mime_type) === input.mimeType && Number(existing.total_bytes) === input.totalBytes
      && String(existing.sha256) === input.sha256.toLowerCase() && Number(existing.chunk_size) === input.chunkSize
      && Number(existing.total_chunks) === input.totalChunks && String(existing.file_name) === cleanFileName(input.fileName);
    if (!same) throw new SandboxAssetUploadError(Number(existing.owner_user_id) === input.ownerUserId ? 'CONFLICT' : 'FORBIDDEN', 'Upload id already exists');
    return sessionFromRow(existing);
  }
  await database.execute({
    sql: `INSERT INTO v3_asset_upload_sessions
      (id, asset_id, owner_user_id, mime_type, file_name, total_bytes, sha256, chunk_size, total_chunks, next_chunk_index, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?) ON CONFLICT(id) DO NOTHING`,
    args: [input.uploadId, input.assetId, input.ownerUserId, input.mimeType, cleanFileName(input.fileName), input.totalBytes,
      input.sha256.toLowerCase(), input.chunkSize, input.totalChunks, input.createdAt, expiresAt],
  });
  const inserted = await getSessionRow(database, input.uploadId);
  if (!inserted || Number(inserted.owner_user_id) !== input.ownerUserId || String(inserted.asset_id) !== input.assetId
    || String(inserted.mime_type) !== input.mimeType || Number(inserted.total_bytes) !== input.totalBytes
    || String(inserted.sha256) !== input.sha256.toLowerCase() || Number(inserted.chunk_size) !== input.chunkSize
    || Number(inserted.total_chunks) !== input.totalChunks || String(inserted.file_name) !== cleanFileName(input.fileName)) {
    throw new SandboxAssetUploadError(inserted && Number(inserted.owner_user_id) !== input.ownerUserId ? 'FORBIDDEN' : 'CONFLICT',
      'Upload id already exists');
  }
  return sessionFromRow(inserted);
};

export const uploadSandboxAssetChunk = async (
  database: SandboxWriteDatabase,
  input: { uploadId: string; ownerUserId: number; chunkIndex: number; base64Data: string; sha256: string; now: string },
): Promise<SandboxAssetUploadSession> => {
  const row = await requireOwnedSession(database, input.uploadId, input.ownerUserId, input.now);
  if (String(row.status) !== 'active') throw new SandboxAssetUploadError('CONFLICT', 'Upload is already finalized');
  const totalChunks = Number(row.total_chunks);
  if (input.chunkIndex < 0 || input.chunkIndex >= totalChunks) throw new SandboxAssetUploadError('SEQUENCE', 'Chunk index is outside the upload plan');
  const buffer = decodeCanonicalBase64(input.base64Data);
  const expectedBytes = input.chunkIndex === totalChunks - 1
    ? Number(row.total_bytes) - Number(row.chunk_size) * (totalChunks - 1) : Number(row.chunk_size);
  if (!buffer.length || buffer.length > MAX_ASSET_CHUNK_BYTES || buffer.length !== expectedBytes) {
    throw new SandboxAssetUploadError('LIMIT', 'Chunk size does not match the upload plan');
  }
  const digest = createHash('sha256').update(buffer).digest('hex');
  if (digest !== input.sha256.toLowerCase()) throw new SandboxAssetUploadError('CHECKSUM', 'Chunk checksum mismatch');
  const next = Number(row.next_chunk_index);
  const existing = await database.execute({
    sql: 'SELECT bytes, sha256 FROM v3_asset_upload_chunks WHERE session_id = ? AND chunk_index = ?', args: [input.uploadId, input.chunkIndex],
  });
  if (existing.rows[0]) {
    if (Number(existing.rows[0].bytes) !== buffer.length || String(existing.rows[0].sha256) !== digest) {
      throw new SandboxAssetUploadError('CONFLICT', 'Chunk index already contains different data');
    }
    if (input.chunkIndex < next) return sessionFromRow(row);
  }
  if (input.chunkIndex !== next) throw new SandboxAssetUploadError('SEQUENCE', `Expected chunk ${next}`);
  await database.batch([
    { sql: `INSERT INTO v3_asset_upload_chunks (session_id, chunk_index, data_base64, bytes, sha256)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id, chunk_index) DO NOTHING`,
      args: [input.uploadId, input.chunkIndex, input.base64Data, buffer.length, digest] },
    { sql: `UPDATE v3_asset_upload_sessions SET next_chunk_index = next_chunk_index + 1
      WHERE id = ? AND status = 'active' AND next_chunk_index = ?`, args: [input.uploadId, input.chunkIndex] },
  ]);
  const updated = await requireOwnedSession(database, input.uploadId, input.ownerUserId, input.now);
  if (Number(updated.next_chunk_index) < input.chunkIndex + 1) throw new SandboxAssetUploadError('CONFLICT', 'Concurrent chunk upload conflict');
  // Another request may have won the INSERT between our preflight SELECT and
  // the transaction. Confirm that the accepted index contains these bytes,
  // rather than treating a conflicting concurrent retry as successful.
  const accepted = await database.execute({
    sql: 'SELECT bytes, sha256 FROM v3_asset_upload_chunks WHERE session_id = ? AND chunk_index = ?',
    args: [input.uploadId, input.chunkIndex],
  });
  if (Number(accepted.rows[0]?.bytes) !== buffer.length || String(accepted.rows[0]?.sha256) !== digest) {
    throw new SandboxAssetUploadError('CONFLICT', 'Chunk index already contains different data');
  }
  return sessionFromRow(updated);
};

export const finalizeSandboxAssetUpload = async (
  database: SandboxWriteDatabase, input: { uploadId: string; ownerUserId: number; now: string },
): Promise<SandboxAssetMetadata> => {
  const row = await requireOwnedSession(database, input.uploadId, input.ownerUserId, input.now);
  if (String(row.status) === 'finalized') {
    const asset = await getOwnedAsset(database, String(row.asset_id), input.ownerUserId, false);
    if (!asset) throw new SandboxAssetUploadError('CONFLICT', 'Finalized asset is missing');
    return asset;
  }
  if (Number(row.next_chunk_index) !== Number(row.total_chunks)) throw new SandboxAssetUploadError('SEQUENCE', 'Upload has missing chunks');
  const chunks = await database.execute({
    sql: 'SELECT chunk_index, data_base64, bytes FROM v3_asset_upload_chunks WHERE session_id = ? ORDER BY chunk_index', args: [input.uploadId],
  });
  if (chunks.rows.length !== Number(row.total_chunks)) throw new SandboxAssetUploadError('SEQUENCE', 'Upload has missing chunks');
  const buffers = chunks.rows.map((chunk, index) => {
    if (Number(chunk.chunk_index) !== index) throw new SandboxAssetUploadError('SEQUENCE', 'Upload has missing chunks');
    const decoded = decodeCanonicalBase64(String(chunk.data_base64));
    if (decoded.length !== Number(chunk.bytes)) throw new SandboxAssetUploadError('CHECKSUM', 'Stored chunk is invalid');
    return decoded;
  });
  const totalBytes = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  if (totalBytes !== Number(row.total_bytes) || totalBytes > MAX_ASSET_BYTES) throw new SandboxAssetUploadError('LIMIT', 'Final asset size is invalid');
  const buffer = Buffer.concat(buffers, totalBytes);
  const digest = createHash('sha256').update(buffer).digest('hex');
  if (digest !== String(row.sha256)) throw new SandboxAssetUploadError('CHECKSUM', 'Asset checksum mismatch');
  const metadata = await uploadSandboxAsset(database, { assetId: String(row.asset_id), mimeType: String(row.mime_type),
    base64Data: buffer.toString('base64'), createdAt: input.now, userId: input.ownerUserId, fileName: String(row.file_name) });
  await database.batch([
    { sql: 'DELETE FROM v3_asset_upload_chunks WHERE session_id = ?', args: [input.uploadId] },
    { sql: `UPDATE v3_asset_upload_sessions SET status = 'finalized', finalized_at = ?, next_chunk_index = total_chunks WHERE id = ?`,
      args: [input.now, input.uploadId] },
  ]);
  return metadata;
};

export const abortSandboxAssetUpload = async (
  database: SandboxWriteDatabase, input: { uploadId: string; ownerUserId: number; now: string },
): Promise<void> => {
  const row = await requireOwnedSession(database, input.uploadId, input.ownerUserId, input.now);
  if (String(row.status) === 'finalized') throw new SandboxAssetUploadError('CONFLICT', 'Finalized upload cannot be aborted');
  await database.batch([
    { sql: 'DELETE FROM v3_asset_upload_chunks WHERE session_id = ?', args: [input.uploadId] },
    { sql: 'DELETE FROM v3_asset_upload_sessions WHERE id = ?', args: [input.uploadId] },
  ]);
};

export const uploadSandboxAsset = async (
  database: SandboxWriteDatabase,
  input: { assetId: string; mimeType: string; base64Data: string; createdAt: string; userId?: number; fileName?: string },
): Promise<SandboxAssetMetadata> => {
  if (!supportedMimeType(input.mimeType)) throw new Error('Unsupported asset MIME type');
  const buffer = decodeCanonicalBase64(input.base64Data);
  if (buffer.length === 0 || buffer.length > MAX_ASSET_BYTES) throw new Error('Asset exceeds the 20 MB limit');
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const existingResult = await database.execute({ sql: 'SELECT mime_type, bytes, sha256 FROM v3_assets WHERE id = ?', args: [input.assetId] });
  const existing = existingResult.rows[0] as unknown as Record<string, unknown> | undefined;
  if (existing) {
    if (input.userId !== undefined) {
      const owner = await database.execute({ sql: 'SELECT user_id FROM v3_asset_owners WHERE asset_id = ?', args: [input.assetId] });
      if (Number(owner.rows[0]?.user_id) !== input.userId) throw new SandboxAssetConflictError();
    }
    if (String(existing.sha256) !== sha256 || String(existing.mime_type) !== input.mimeType) throw new SandboxAssetConflictError();
    return { assetId: input.assetId, mimeType: String(existing.mime_type), bytes: Number(existing.bytes), sha256: String(existing.sha256) };
  }
  const statements: InStatement[] = [{
    sql: `INSERT INTO v3_assets (id, mime_type, data_base64, bytes, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [input.assetId, input.mimeType, input.base64Data, buffer.length, sha256, input.createdAt],
  }];
  if (input.userId !== undefined) statements.push({
    sql: 'INSERT INTO v3_asset_owners (asset_id, user_id, file_name) VALUES (?, ?, ?)',
    args: [input.assetId, input.userId, cleanFileName(input.fileName)],
  });
  await database.batch(statements);
  return { assetId: input.assetId, mimeType: input.mimeType, bytes: buffer.length, sha256 };
};

export async function getOwnedAsset(database: SandboxWriteDatabase, assetId: string, userId?: number, includeData = true) {
  const result = await database.execute({
    sql: `SELECT a.id, a.mime_type, a.bytes, a.sha256, ${includeData ? 'a.data_base64' : "'' AS data_base64"}, o.file_name
      FROM v3_assets a LEFT JOIN v3_asset_owners o ON o.asset_id = a.id
      WHERE a.id = ?${userId === undefined ? '' : ' AND o.user_id = ?'}`,
    args: userId === undefined ? [assetId] : [assetId, userId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return { assetId: String(row.id), mimeType: String(row.mime_type), bytes: Number(row.bytes), sha256: String(row.sha256),
    base64Data: String(row.data_base64), fileName: String(row.file_name ?? 'attachment') };
}
