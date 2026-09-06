import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';

export type SandboxMessage = {
  messageId: string;
  senderUserId: number;
  recipientUserId: number;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type SandboxPhotoMessage = {
  photoId: string;
  assetId: string;
  caption: string;
  scheduledAt: string;
  viewedAt: string | null;
};

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_messages (
    id TEXT PRIMARY KEY,
    sender_user_id INTEGER NOT NULL,
    recipient_user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS v3_message_reads (
    message_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    read_at TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES v3_messages(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS v3_photo_messages (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    caption TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS v3_photo_views (
    photo_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    viewed_at TEXT NOT NULL,
    PRIMARY KEY (photo_id, user_id),
    FOREIGN KEY (photo_id) REFERENCES v3_photo_messages(id) ON DELETE CASCADE
  )`,
];

const rowNumber = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);

export const initializeSandboxCommunicationSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

export const sendSandboxMessage = async (
  database: SandboxWriteDatabase,
  input: { messageId: string; senderUserId: number; recipientUserId: number; body: string; createdAt: string },
): Promise<SandboxMessage> => {
  await database.batch([{
    sql: `INSERT OR IGNORE INTO v3_messages (id, sender_user_id, recipient_user_id, body, created_at)
      VALUES (?, ?, ?, ?, ?)`,
    args: [input.messageId, input.senderUserId, input.recipientUserId, input.body, input.createdAt],
  }]);
  const result = await database.execute({
    sql: `SELECT messages.id, messages.sender_user_id, messages.recipient_user_id, messages.body, messages.created_at, reads.read_at
      FROM v3_messages messages
      LEFT JOIN v3_message_reads reads ON reads.message_id = messages.id
      WHERE messages.id = ?`,
    args: [input.messageId],
  });
  const row = result.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) throw new Error('Message was not created');
  if (
    rowNumber(row.sender_user_id) !== input.senderUserId
    || rowNumber(row.recipient_user_id) !== input.recipientUserId
    || String(row.body) !== input.body
  ) throw new Error('Message identity conflict');
  return {
    messageId: String(row.id),
    senderUserId: rowNumber(row.sender_user_id),
    recipientUserId: rowNumber(row.recipient_user_id),
    body: String(row.body),
    createdAt: String(row.created_at),
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
  };
};

export const listSandboxMessages = async (
  database: SandboxWriteDatabase,
  input: { userId: number; otherUserId?: number },
): Promise<readonly SandboxMessage[]> => {
  const args: (string | number)[] = [input.userId, input.userId];
  let scope = '(sender_user_id = ? OR recipient_user_id = ?)';
  if (input.otherUserId !== undefined) {
    scope += ' AND ((sender_user_id = ? AND recipient_user_id = ?) OR (sender_user_id = ? AND recipient_user_id = ?))';
    args.push(input.userId, input.otherUserId, input.otherUserId, input.userId);
  }
  const result = await database.execute({
    sql: `SELECT messages.id, messages.sender_user_id, messages.recipient_user_id, messages.body, messages.created_at, reads.read_at
      FROM v3_messages messages
      LEFT JOIN v3_message_reads reads ON reads.message_id = messages.id
      WHERE ${scope} ORDER BY messages.created_at, messages.id`,
    args,
  });
  return result.rows.map((row) => {
    const message = row as unknown as Record<string, unknown>;
    return {
      messageId: String(message.id),
      senderUserId: rowNumber(message.sender_user_id),
      recipientUserId: rowNumber(message.recipient_user_id),
      body: String(message.body),
      createdAt: String(message.created_at),
      readAt: typeof message.read_at === 'string' ? message.read_at : null,
    };
  });
};

export const listSandboxConversations = async (
  database: SandboxWriteDatabase,
  teacherUserId: number,
): Promise<readonly { studentUserId: number; lastMessage: SandboxMessage | null; unreadCount: number }[]> => {
  const result = await database.execute({
    sql: `SELECT student_id, MAX(created_at) AS last_created_at,
      SUM(CASE WHEN recipient_user_id = ? AND reads.message_id IS NULL THEN 1 ELSE 0 END) AS unread_count
      FROM (
        SELECT CASE WHEN sender_user_id = ? THEN recipient_user_id ELSE sender_user_id END AS student_id,
          id, sender_user_id, recipient_user_id, body, created_at
        FROM v3_messages
        WHERE sender_user_id = ? OR recipient_user_id = ?
      ) messages
      LEFT JOIN v3_message_reads reads ON reads.message_id = messages.id
      GROUP BY student_id ORDER BY last_created_at DESC`,
    args: [teacherUserId, teacherUserId, teacherUserId, teacherUserId],
  });
  const conversations = [];
  for (const row of result.rows) {
    const value = row as unknown as Record<string, unknown>;
    const studentUserId = rowNumber(value.student_id);
    const messages = await listSandboxMessages(database, { userId: teacherUserId, otherUserId: studentUserId });
    conversations.push({
      studentUserId,
      lastMessage: messages[messages.length - 1] ?? null,
      unreadCount: rowNumber(value.unread_count),
    });
  }
  return conversations;
};

export const markSandboxMessageRead = async (
  database: SandboxWriteDatabase,
  input: { messageId: string; userId: number; readAt: string },
): Promise<boolean> => {
  const message = await database.execute({
    sql: 'SELECT 1 AS present FROM v3_messages WHERE id = ? AND recipient_user_id = ?',
    args: [input.messageId, input.userId],
  });
  if (message.rows.length === 0) return false;
  await database.batch([{
    sql: `INSERT OR IGNORE INTO v3_message_reads (message_id, user_id, read_at)
      SELECT ?, ?, ? WHERE EXISTS (
        SELECT 1 FROM v3_messages
        WHERE id = ? AND recipient_user_id = ?
      )`,
    args: [input.messageId, input.userId, input.readAt, input.messageId, input.userId],
  }]);
  return true;
};

export const scheduleSandboxPhotoMessage = async (
  database: SandboxWriteDatabase,
  input: { photoId: string; assetId: string; caption: string; scheduledAt: string; createdAt: string },
): Promise<void> => {
  await database.batch([{
    sql: `INSERT OR IGNORE INTO v3_photo_messages
      (id, asset_id, caption, scheduled_at, created_at)
      VALUES (?, ?, ?, ?, ?)`,
    args: [input.photoId, input.assetId, input.caption, input.scheduledAt, input.createdAt],
  }]);
};

export const listAvailableSandboxPhotos = async (
  database: SandboxWriteDatabase,
  input: { userId: number; now: string },
): Promise<readonly SandboxPhotoMessage[]> => {
  const result = await database.execute({
    sql: `SELECT photos.id, photos.asset_id, photos.caption, photos.scheduled_at, views.viewed_at
      FROM v3_photo_messages photos
      LEFT JOIN v3_photo_views views
        ON views.photo_id = photos.id AND views.user_id = ?
      WHERE datetime(photos.scheduled_at) <= datetime(?)
      ORDER BY photos.scheduled_at, photos.id`,
    args: [input.userId, input.now],
  });
  return result.rows.map((row) => {
    const photo = row as unknown as Record<string, unknown>;
    return {
      photoId: String(photo.id),
      assetId: String(photo.asset_id),
      caption: String(photo.caption),
      scheduledAt: String(photo.scheduled_at),
      viewedAt: typeof photo.viewed_at === 'string' ? photo.viewed_at : null,
    };
  });
};

export const listAllSandboxPhotos = async (database: SandboxWriteDatabase): Promise<readonly SandboxPhotoMessage[]> => {
  const result = await database.execute(
    'SELECT id, asset_id, caption, scheduled_at FROM v3_photo_messages ORDER BY scheduled_at DESC, id DESC',
  );
  return result.rows.map(raw => {
    const row = raw as unknown as Record<string, unknown>;
    return { photoId: String(row.id), assetId: String(row.asset_id), caption: String(row.caption),
      scheduledAt: String(row.scheduled_at), viewedAt: null };
  });
};

export const markSandboxPhotoViewed = async (
  database: SandboxWriteDatabase,
  input: { photoId: string; userId: number; viewedAt: string },
): Promise<boolean> => {
  const photo = await database.execute({
    sql: 'SELECT 1 AS present FROM v3_photo_messages WHERE id = ? AND datetime(scheduled_at) <= datetime(?)',
    args: [input.photoId, input.viewedAt],
  });
  if (photo.rows.length === 0) return false;
  await database.batch([{
    sql: `INSERT OR IGNORE INTO v3_photo_views (photo_id, user_id, viewed_at)
      SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM v3_photo_messages WHERE id = ?)`,
    args: [input.photoId, input.userId, input.viewedAt, input.photoId],
  }]);
  return true;
};

export const deleteSandboxPhotoMessage = async (database: SandboxWriteDatabase, photoId: string): Promise<boolean> => {
  const result = await database.execute({
    sql: 'DELETE FROM v3_photo_messages WHERE id = ?',
    args: [photoId],
  });
  return result.rowsAffected === 1;
};
