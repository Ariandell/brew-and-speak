import type { ReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import {
  listAvailableSandboxPhotos,
  listAllSandboxPhotos,
  deleteSandboxPhotoMessage,
  listSandboxMessages,
  markSandboxMessageRead,
  markSandboxPhotoViewed,
  type SandboxMessage,
  type SandboxPhotoMessage,
} from './sandboxCommunicationRepository.js';

const LEGACY_CHAT_PREFIX = 'legacy-chat:';
const LEGACY_PHOTO_PREFIX = 'legacy-photo:';

const positiveInteger = (value: unknown, field: string): number => {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Legacy communication row has invalid ${field}`);
  return number;
};

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') throw new Error(`Legacy communication row has invalid ${field}`);
  return value;
};

export const canonicalCommunicationDate = (value: unknown): string => {
  const source = requiredString(value, 'date').trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(source)
    ? `${source.replace(' ', 'T')}Z`
    : source;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) throw new Error('Legacy communication row has invalid date');
  return date.toISOString();
};

const legacyMessageId = (id: number): string => `${LEGACY_CHAT_PREFIX}${id}`;
const legacyPhotoId = (id: number): string => `${LEGACY_PHOTO_PREFIX}${id}`;

const parseLegacyId = (value: string, prefix: string): number | null => {
  if (!value.startsWith(prefix)) return null;
  const id = Number(value.slice(prefix.length));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const normalizeV3Message = (message: SandboxMessage): SandboxMessage => ({
  ...message,
  createdAt: canonicalCommunicationDate(message.createdAt),
  readAt: message.readAt ? canonicalCommunicationDate(message.readAt) : null,
});

export const listEffectiveMessages = async (
  readDatabase: ReadOnlyDatabase,
  writeDatabase: SandboxWriteDatabase,
  input: { userId: number; otherUserId?: number },
): Promise<readonly SandboxMessage[]> => {
  const args: number[] = [input.userId, input.userId];
  let scope = '(sender_id = ? OR receiver_id = ?)';
  if (input.otherUserId !== undefined) {
    scope = '((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))';
    args.splice(0, args.length, input.userId, input.otherUserId, input.otherUserId, input.userId);
  }
  const [legacyResult, v3Messages] = await Promise.all([
    readDatabase.execute({
      sql: `SELECT id, sender_id, receiver_id, text, created_at, is_read
        FROM messages WHERE ${scope} ORDER BY created_at, id`,
      args,
    }),
    listSandboxMessages(writeDatabase, input),
  ]);
  const legacyMessages = legacyResult.rows.map((raw): SandboxMessage => {
    const row = raw as unknown as Record<string, unknown>;
    const createdAt = canonicalCommunicationDate(row.created_at);
    const isRead = Number(row.is_read);
    if (isRead !== 0 && isRead !== 1) throw new Error('Legacy communication row has invalid is_read');
    return {
      messageId: legacyMessageId(positiveInteger(row.id, 'id')),
      senderUserId: positiveInteger(row.sender_id, 'sender_id'),
      recipientUserId: positiveInteger(row.receiver_id, 'receiver_id'),
      body: requiredString(row.text, 'text'),
      createdAt,
      // The legacy schema stores only a boolean, not the time it was read.
      readAt: isRead === 1 ? createdAt : null,
    };
  });
  return [...legacyMessages, ...v3Messages.map(normalizeV3Message)]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.messageId.localeCompare(right.messageId));
};

export const listEffectiveConversations = async (
  readDatabase: ReadOnlyDatabase,
  writeDatabase: SandboxWriteDatabase,
  teacherUserId: number,
  studentUserIds: readonly number[],
): Promise<readonly { studentUserId: number; lastMessage: SandboxMessage | null; unreadCount: number }[]> => {
  const conversations = await Promise.all(studentUserIds.map(async (studentUserId) => {
    const messages = await listEffectiveMessages(readDatabase, writeDatabase, { userId: teacherUserId, otherUserId: studentUserId });
    return {
      studentUserId,
      lastMessage: messages[messages.length - 1] ?? null,
      unreadCount: messages.filter((message) => message.recipientUserId === teacherUserId && message.readAt === null).length,
    };
  }));
  return conversations
    .filter((conversation) => conversation.lastMessage !== null)
    .sort((left, right) => (right.lastMessage?.createdAt ?? '').localeCompare(left.lastMessage?.createdAt ?? '')
      || left.studentUserId - right.studentUserId);
};

export const markEffectiveMessageRead = async (
  writeDatabase: SandboxWriteDatabase,
  input: { messageId: string; userId: number; readAt: string },
): Promise<boolean> => {
  const legacyId = parseLegacyId(input.messageId, LEGACY_CHAT_PREFIX);
  if (legacyId !== null) {
    const result = await writeDatabase.execute({
      sql: 'UPDATE messages SET is_read = 1 WHERE id = ? AND receiver_id = ?',
      args: [legacyId, input.userId],
    });
    return result.rowsAffected === 1;
  }
  return markSandboxMessageRead(writeDatabase, input);
};

const assetIdFromLegacyUrl = (value: unknown): string => {
  const url = requiredString(value, 'image_url').trim();
  const match = /^\/api\/assets\/([^/?#]+)(?:[?#].*)?$/.exec(url);
  return match ? decodeURIComponent(match[1]) : url;
};

const normalizeV3Photo = (photo: SandboxPhotoMessage): SandboxPhotoMessage => ({
  ...photo,
  scheduledAt: canonicalCommunicationDate(photo.scheduledAt),
  viewedAt: photo.viewedAt ? canonicalCommunicationDate(photo.viewedAt) : null,
});

export const listEffectivePhotos = async (
  readDatabase: ReadOnlyDatabase,
  writeDatabase: SandboxWriteDatabase,
  input: { userId: number; now: string },
): Promise<readonly SandboxPhotoMessage[]> => {
  const now = canonicalCommunicationDate(input.now);
  const [legacyResult, v3Photos] = await Promise.all([
    readDatabase.execute({
      sql: `SELECT photos.id, photos.image_url, photos.caption, photos.scheduled_at, views.viewed_at
        FROM photo_messages photos
        LEFT JOIN photo_message_views views ON views.message_id = photos.id AND views.user_id = ?
        ORDER BY photos.scheduled_at, photos.id`,
      args: [input.userId],
    }),
    listAvailableSandboxPhotos(writeDatabase, { userId: input.userId, now }),
  ]);
  const legacyPhotos = legacyResult.rows.map((raw): SandboxPhotoMessage => {
    const row = raw as unknown as Record<string, unknown>;
    return {
      photoId: legacyPhotoId(positiveInteger(row.id, 'id')),
      assetId: assetIdFromLegacyUrl(row.image_url),
      caption: typeof row.caption === 'string' ? row.caption : '',
      scheduledAt: canonicalCommunicationDate(row.scheduled_at),
      viewedAt: row.viewed_at === null || row.viewed_at === undefined ? null : canonicalCommunicationDate(row.viewed_at),
    };
  }).filter((photo) => photo.scheduledAt <= now);
  return [...legacyPhotos, ...v3Photos.map(normalizeV3Photo)]
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt) || left.photoId.localeCompare(right.photoId));
};

export const listEffectiveTeacherPhotos = async (
  readDatabase: ReadOnlyDatabase,
  writeDatabase: SandboxWriteDatabase,
): Promise<readonly SandboxPhotoMessage[]> => {
  const [legacyResult, v3Photos] = await Promise.all([
    readDatabase.execute('SELECT id, image_url, caption, scheduled_at FROM photo_messages ORDER BY scheduled_at DESC, id DESC'),
    listAllSandboxPhotos(writeDatabase),
  ]);
  const legacy = legacyResult.rows.map(raw => {
    const row = raw as unknown as Record<string, unknown>;
    return { photoId: legacyPhotoId(positiveInteger(row.id, 'id')), assetId: assetIdFromLegacyUrl(row.image_url),
      caption: typeof row.caption === 'string' ? row.caption : '', scheduledAt: canonicalCommunicationDate(row.scheduled_at), viewedAt: null };
  });
  return [...legacy, ...v3Photos.map(normalizeV3Photo)]
    .sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt) || right.photoId.localeCompare(left.photoId));
};

export const deleteEffectivePhoto = async (
  writeDatabase: SandboxWriteDatabase,
  photoId: string,
): Promise<boolean> => {
  const legacyId = parseLegacyId(photoId, LEGACY_PHOTO_PREFIX);
  if (legacyId === null) return deleteSandboxPhotoMessage(writeDatabase, photoId);
  const existing = await writeDatabase.execute({ sql: 'SELECT 1 AS present FROM photo_messages WHERE id = ?', args: [legacyId] });
  if (existing.rows.length === 0) return false;
  await writeDatabase.batch([
    { sql: 'DELETE FROM photo_message_views WHERE message_id = ?', args: [legacyId] },
    { sql: 'DELETE FROM photo_messages WHERE id = ?', args: [legacyId] },
  ]);
  return true;
};

export const markEffectivePhotoViewed = async (
  writeDatabase: SandboxWriteDatabase,
  input: { photoId: string; userId: number; viewedAt: string },
): Promise<boolean> => {
  const legacyId = parseLegacyId(input.photoId, LEGACY_PHOTO_PREFIX);
  if (legacyId !== null) {
    const result = await writeDatabase.execute({
      sql: `INSERT OR IGNORE INTO photo_message_views (user_id, message_id, viewed_at)
        SELECT ?, ?, ? WHERE EXISTS (
          SELECT 1 FROM photo_messages WHERE id = ? AND datetime(scheduled_at) <= datetime(?)
        )`,
      args: [input.userId, legacyId, canonicalCommunicationDate(input.viewedAt), legacyId, canonicalCommunicationDate(input.viewedAt)],
    });
    if (result.rowsAffected === 1) return true;
    const existing = await writeDatabase.execute({
      sql: 'SELECT 1 AS present FROM photo_message_views WHERE user_id = ? AND message_id = ?',
      args: [input.userId, legacyId],
    });
    return existing.rows.length > 0;
  }
  return markSandboxPhotoViewed(writeDatabase, input);
};
