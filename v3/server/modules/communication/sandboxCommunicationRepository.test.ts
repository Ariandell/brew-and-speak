import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import {
  initializeSandboxCommunicationSchema,
  listSandboxConversations,
  listSandboxMessages,
  listAvailableSandboxPhotos,
  markSandboxMessageRead,
  markSandboxPhotoViewed,
  scheduleSandboxPhotoMessage,
  sendSandboxMessage,
} from './sandboxCommunicationRepository.js';

const withDatabase = async (run: (database: SandboxWriteDatabase) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-communication-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxCommunicationSchema(database);
    await run(database);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
};

test('chat message and read state are idempotent', async () => {
  await withDatabase(async (database) => {
    const message = await sendSandboxMessage(database, {
      messageId: 'message-1', senderUserId: 7, recipientUserId: 9, body: 'Hello', createdAt: '2026-08-17T13:00:00.000Z',
    });
    assert.equal(message.readAt, null);
    assert.equal(await markSandboxMessageRead(database, {
      messageId: 'message-1', userId: 7, readAt: '2026-08-17T13:01:00.000Z',
    }), false);
    assert.equal(await markSandboxMessageRead(database, {
      messageId: 'message-1', userId: 9, readAt: '2026-08-17T13:01:00.000Z',
    }), true);
    assert.equal(await markSandboxMessageRead(database, {
      messageId: 'message-1', userId: 9, readAt: '2026-08-17T13:02:00.000Z',
    }), true);
    const loaded = await sendSandboxMessage(database, {
      messageId: 'message-1', senderUserId: 7, recipientUserId: 9, body: 'Hello', createdAt: 'different',
    });
    assert.equal(loaded.readAt, '2026-08-17T13:01:00.000Z');
    await assert.rejects(
      () => sendSandboxMessage(database, {
        messageId: 'message-1', senderUserId: 8, recipientUserId: 9, body: 'Impostor', createdAt: 'different',
      }),
      /identity conflict/,
    );
  });
});

test('chat conversations are scoped to teacher and student participants', async () => {
  await withDatabase(async (database) => {
    await sendSandboxMessage(database, {
      messageId: 'message-2', senderUserId: 7, recipientUserId: 9, body: 'Question', createdAt: '2026-08-17T13:00:00.000Z',
    });
    await sendSandboxMessage(database, {
      messageId: 'message-3', senderUserId: 9, recipientUserId: 7, body: 'Answer', createdAt: '2026-08-17T13:01:00.000Z',
    });
    const messages = await listSandboxMessages(database, { userId: 9, otherUserId: 7 });
    assert.deepEqual(messages.map((message) => message.body), ['Question', 'Answer']);
    const conversations = await listSandboxConversations(database, 9);
    assert.equal(conversations[0].studentUserId, 7);
    assert.equal(conversations[0].lastMessage?.body, 'Answer');
  });
});

test('scheduled photos are invisible before server time and views are idempotent', async () => {
  await withDatabase(async (database) => {
    await scheduleSandboxPhotoMessage(database, {
      photoId: 'photo-future', assetId: 'asset-future', caption: 'Later',
      scheduledAt: '2026-08-18T10:00:00.000Z', createdAt: '2026-08-17T10:00:00.000Z',
    });
    await scheduleSandboxPhotoMessage(database, {
      photoId: 'photo-now', assetId: 'asset-now', caption: 'Now',
      scheduledAt: '2026-08-17T10:00:00.000Z', createdAt: '2026-08-16T10:00:00.000Z',
    });
    let photos = await listAvailableSandboxPhotos(database, {
      userId: 7, now: '2026-08-17T12:00:00.000Z',
    });
    assert.deepEqual(photos.map((photo) => photo.photoId), ['photo-now']);
    await markSandboxPhotoViewed(database, {
      photoId: 'photo-now', userId: 7, viewedAt: '2026-08-17T12:01:00.000Z',
    });
    await markSandboxPhotoViewed(database, {
      photoId: 'photo-now', userId: 7, viewedAt: '2026-08-17T12:02:00.000Z',
    });
    photos = await listAvailableSandboxPhotos(database, {
      userId: 7, now: '2026-08-18T12:00:00.000Z',
    });
    assert.deepEqual(photos.map((photo) => [photo.photoId, photo.viewedAt]), [
      ['photo-now', '2026-08-17T12:01:00.000Z'],
      ['photo-future', null],
    ]);
  });
});
