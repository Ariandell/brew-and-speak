import { createHash } from 'node:crypto';
import type { InArgs } from '@libsql/client';
import type { LegacyLessonBlock } from '../../modules/legacy/repositories.js';
import { normalizeLessonBlock } from '../../modules/lessons/normalizeBlock.js';
import type { ReadOnlyDatabase } from './readOnlySql.js';

type Row = Record<string, unknown>;

const rowsOf = async (database: ReadOnlyDatabase, sql: string, args: InArgs = []): Promise<readonly Row[]> => {
  const result = await database.execute({ sql, args });
  return result.rows as unknown as readonly Row[];
};

const countFrom = async (database: ReadOnlyDatabase, table: string): Promise<number> => {
  const rows = await rowsOf(database, `SELECT COUNT(*) AS count FROM ${table}`);
  const count = rows[0]?.count;
  return typeof count === 'number' ? count : Number(count ?? 0);
};

const existingTables = async (database: ReadOnlyDatabase): Promise<Set<string>> => {
  const rows = await rowsOf(database,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return new Set(rows.map((row) => typeof row.name === 'string' ? row.name : ''));
};

const legacyBlock = (row: Row): LegacyLessonBlock => ({
  id: Number(row.id),
  type: typeof row.type === 'string' ? row.type : '',
  rawContent: typeof row.content === 'string' ? row.content : '',
  order: Number(row.block_order),
});

export type LegacyInventory = {
  tables: readonly string[];
  rowCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  /** Stable inherited-content digest; app_assets payloads are represented by byte length. */
  contentFingerprintSha256: string;
  anomalies: {
    demoUserSrsRows: number;
    unmappedSrsRows: number;
    perfectLegacyScores: number;
    unsupportedBlocks: number;
    orphanAssetCandidates: number;
  };
};

const emptyReport = (tables: readonly string[]): LegacyInventory => ({
  tables,
  rowCounts: {},
  roleCounts: {},
  contentFingerprintSha256: '',
  anomalies: {
    demoUserSrsRows: 0,
    unmappedSrsRows: 0,
    perfectLegacyScores: 0,
    unsupportedBlocks: 0,
    orphanAssetCandidates: 0,
  },
});

export const collectLegacyInventory = async (database: ReadOnlyDatabase): Promise<LegacyInventory> => {
  const tables = await existingTables(database);
  const report = emptyReport([...tables].sort());
  const expectedTables = [
    'users',
    'levels',
    'lessons',
    'lesson_blocks',
    'user_progress',
    'flashcards',
    'user_flashcard_progress',
    'homework_submissions',
    'app_assets',
    'messages',
    'photo_messages',
    'photo_message_views',
  ];

  const fingerprint = createHash('sha256');
  const stableValue = (value: unknown): unknown => typeof value === 'bigint' ? value.toString()
    : value instanceof Uint8Array ? Buffer.from(value).toString('base64') : value;

  for (const table of expectedTables) {
    if (!tables.has(table)) continue;
    report.rowCounts[table] = await countFrom(database, table);
    const rows = await rowsOf(database, table === 'app_assets'
      ? 'SELECT id, mime_type, length(data) AS payload_length FROM app_assets ORDER BY id'
      : `SELECT * FROM ${table} ORDER BY rowid`);
    fingerprint.update(`${table}\n`);
    for (const row of rows) {
      const canonical = Object.fromEntries(Object.entries(row).sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => [name, stableValue(value)]));
      fingerprint.update(`${JSON.stringify(canonical)}\n`);
    }
  }
  report.contentFingerprintSha256 = fingerprint.digest('hex');

  if (tables.has('users')) {
    const rows = await rowsOf(database, 'SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY role');
    for (const row of rows) {
      if (typeof row.role === 'string') report.roleCounts[row.role] = Number(row.count ?? 0);
    }
  }

  if (tables.has('user_flashcard_progress') && tables.has('users')) {
    const demoRows = await rowsOf(database,
      "SELECT COUNT(*) AS count FROM user_flashcard_progress WHERE user_id = ?",
      ['demo-user']);
    report.anomalies.demoUserSrsRows = Number(demoRows[0]?.count ?? 0);

    const unmappedRows = await rowsOf(database,
      'SELECT COUNT(*) AS count FROM user_flashcard_progress progress LEFT JOIN users ON users.telegram_id = progress.user_id WHERE users.id IS NULL');
    report.anomalies.unmappedSrsRows = Number(unmappedRows[0]?.count ?? 0);
  }

  if (tables.has('user_progress')) {
    const perfectRows = await rowsOf(database,
      "SELECT COUNT(*) AS count FROM user_progress WHERE status = 'completed' AND score = 10");
    report.anomalies.perfectLegacyScores = Number(perfectRows[0]?.count ?? 0);
  }

  if (tables.has('lesson_blocks')) {
    const rows = await rowsOf(database,
      'SELECT id, type, content, "order" AS block_order FROM lesson_blocks ORDER BY id');
    report.anomalies.unsupportedBlocks = rows
      .map(legacyBlock)
      .filter((block) => normalizeLessonBlock(block).type === 'unsupported')
      .length;
  }

  if (tables.has('app_assets')) {
    const assetRows = await rowsOf(database, 'SELECT id FROM app_assets ORDER BY id');
    const assetIds = assetRows
      .map((row) => typeof row.id === 'string' ? row.id : '')
      .filter(Boolean);
    const references: string[] = [];
    if (tables.has('lesson_blocks')) {
      const rows = await rowsOf(database, 'SELECT content FROM lesson_blocks');
      references.push(...rows.map((row) => typeof row.content === 'string' ? row.content : ''));
    }
    if (tables.has('homework_submissions')) {
      const rows = await rowsOf(database, 'SELECT file_url FROM homework_submissions WHERE file_url IS NOT NULL');
      references.push(...rows.map((row) => typeof row.file_url === 'string' ? row.file_url : ''));
    }
    if (tables.has('photo_messages')) {
      const rows = await rowsOf(database, 'SELECT image_url, caption FROM photo_messages');
      references.push(...rows.flatMap((row) => [
        typeof row.image_url === 'string' ? row.image_url : '',
        typeof row.caption === 'string' ? row.caption : '',
      ]));
    }
    report.anomalies.orphanAssetCandidates = assetIds.filter(
      (assetId) => !references.some((reference) => reference.includes(assetId)),
    ).length;
  }

  return report;
};
