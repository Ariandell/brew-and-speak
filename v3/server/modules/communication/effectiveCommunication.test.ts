import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import {
  initializeSandboxCommunicationSchema,
  scheduleSandboxPhotoMessage,
  sendSandboxMessage,
} from './sandboxCommunicationRepository.js';
import {
  canonicalCommunicationDate,
  listEffectiveConversations,
  listEffectiveMessages,
  listEffectivePhotos,
  markEffectiveMessageRead,
  markEffectivePhotoViewed,
} from './effectiveCommunication.js';

test('interprets legacy naive timestamps as Kyiv wall time across DST', () => {
  assert.equal(canonicalCommunicationDate('2026-08-01 10:00:00'), '2026-08-01T07:00:00.000Z');
  assert.equal(canonicalCommunicationDate('2026-01-01 10:00:00'), '2026-01-01T08:00:00.000Z');
  assert.equal(canonicalCommunicationDate('2026-08-01T10:00:00.000Z'), '2026-08-01T10:00:00.000Z');
});

test('effective communication keeps legacy history visible beside V3 writes and scopes reads to recipients', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-effective-communication-'));
  const path = join(root, 'database.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await database.batch([
      `CREATE TABLE messages (id INTEGER PRIMARY KEY, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL,
        text TEXT NOT NULL, created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE photo_messages (id INTEGER PRIMARY KEY, image_url TEXT NOT NULL, caption TEXT,
        scheduled_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
      `CREATE TABLE photo_message_views (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
        message_id INTEGER NOT NULL, viewed_at TEXT NOT NULL, UNIQUE(user_id, message_id))`,
    ]);
    await initializeSandboxCommunicationSchema(database);
    await database.batch([
      { sql: `INSERT INTO messages VALUES (1, 7, 9, 'Legacy question', '2026-08-01 10:00:00', 0)`, args: [] },
      { sql: `INSERT INTO messages VALUES (2, 9, 7, 'Legacy answer', '2026-08-01 10:01:00', 1)`, args: [] },
      { sql: `INSERT INTO photo_messages VALUES (3, '/api/assets/legacy-asset', 'Legacy photo',
        '2026-08-01 09:00:00', '2026-08-01 08:00:00')`, args: [] },
      { sql: `INSERT INTO photo_messages VALUES (4, '/api/assets/future', 'Future',
        '2026-08-01 14:00:00', '2026-08-01 08:00:00')`, args: [] },
    ]);
    await sendSandboxMessage(database, {
      messageId: 'v3-message', senderUserId: 9, recipientUserId: 7, body: 'V3 answer',
      createdAt: '2026-08-01T10:02:00.000Z',
    });
    await scheduleSandboxPhotoMessage(database, {
      photoId: 'v3-photo', assetId: 'v3-asset', caption: 'V3 photo',
      scheduledAt: '2026-08-01T09:30:00.000Z', createdAt: '2026-08-01T08:00:00.000Z',
    });

    const readDatabase = createReadOnlyDatabase({ url: `file:${path}` });
    const messages = await listEffectiveMessages(readDatabase, database, { userId: 7, otherUserId: 9 });
    assert.deepEqual(messages.map((message) => message.messageId), ['legacy-chat:1', 'legacy-chat:2', 'v3-message']);
    assert.equal(messages[1].readAt, '2026-08-01T07:01:00.000Z');

    assert.equal(await markEffectiveMessageRead(database, {
      messageId: 'legacy-chat:1', userId: 7, readAt: '2026-08-01T11:00:00.000Z',
    }), false, 'sender cannot mark their own outbound legacy message as read');
    assert.equal(await markEffectiveMessageRead(database, {
      messageId: 'legacy-chat:1', userId: 9, readAt: '2026-08-01T11:00:00.000Z',
    }), true);
    assert.equal(await markEffectiveMessageRead(database, {
      messageId: 'v3-message', userId: 9, readAt: '2026-08-01T11:00:00.000Z',
    }), false, 'sender cannot mark their own outbound V3 message as read');

    const conversations = await listEffectiveConversations(readDatabase, database, 9, [7, 8]);
    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].studentUserId, 7);
    assert.equal(conversations[0].lastMessage?.messageId, 'v3-message');

    const photos = await listEffectivePhotos(readDatabase, database, {
      userId: 7, now: '2026-08-01T10:00:00.000Z',
    });
    assert.deepEqual(photos.map((photo) => [photo.photoId, photo.assetId]), [
      ['legacy-photo:3', 'legacy-asset'], ['v3-photo', 'v3-asset'],
    ]);
    assert.equal(await markEffectivePhotoViewed(database, {
      photoId: 'legacy-photo:3', userId: 7, viewedAt: '2026-08-01T10:00:00.000Z',
    }), true);
    assert.equal(await markEffectivePhotoViewed(database, {
      photoId: 'legacy-photo:4', userId: 7, viewedAt: '2026-08-01T10:00:00.000Z',
    }), false, 'future legacy photos cannot be marked viewed early');

    await database.execute({
      sql: `INSERT INTO messages VALUES (5, 7, 9, 'Malformed read state', '2026-08-01 12:00:00', 2)`, args: [],
    });
    await assert.rejects(
      () => listEffectiveMessages(readDatabase, database, { userId: 7, otherUserId: 9 }),
      /invalid is_read/,
    );
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
