import assert from 'node:assert/strict';
import test from 'node:test';
import type { InStatement, ResultSet } from '@libsql/client';
import { collectLegacyInventory } from './legacyInventory.js';
import type { ReadOnlyDatabase } from './readOnlySql.js';

const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [],
  columnTypes: [],
  rows: [...rows] as ResultSet['rows'],
  rowsAffected: 0,
  lastInsertRowid: undefined,
  toJSON: () => ({}),
});

test('legacy inventory reports anomalies without reading asset payloads', async () => {
  const queries: InStatement[] = [];
  const database: ReadOnlyDatabase = {
    async execute(statement) {
      queries.push(statement);
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (sql.includes('sqlite_master')) return result([
        { name: 'users' },
        { name: 'lesson_blocks' },
        { name: 'user_flashcard_progress' },
        { name: 'user_progress' },
        { name: 'app_assets' },
      ]);
      if (sql.includes('GROUP BY role')) return result([{ role: 'student', count: 2 }, { role: 'admin', count: 1 }]);
      if (sql.includes('WHERE user_id = ?')) return result([{ count: 1 }]);
      if (sql.includes('LEFT JOIN users')) return result([{ count: 1 }]);
      if (sql.includes("status = 'completed'")) return result([{ count: 3 }]);
      if (sql.includes('SELECT id FROM app_assets')) return result([{ id: 'asset-used' }, { id: 'asset-orphan' }]);
      if (sql.includes('SELECT content FROM lesson_blocks')) return result([{ content: 'asset-used' }]);
      if (sql.includes('SELECT id, type, content')) return result([{
        id: 1,
        type: 'fill_blank',
        content: JSON.stringify({ sentence: 'I ___ coffee', answer: 'drink', options: ['am'] }),
        block_order: 0,
      }]);
      if (sql.startsWith('SELECT COUNT(*)')) return result([{ count: 1 }]);
      return result([]);
    },
  };

  const report = await collectLegacyInventory(database);
  assert.equal(report.anomalies.demoUserSrsRows, 1);
  assert.equal(report.anomalies.unmappedSrsRows, 1);
  assert.equal(report.anomalies.perfectLegacyScores, 3);
  assert.equal(report.anomalies.unsupportedBlocks, 1);
  assert.equal(report.anomalies.orphanAssetCandidates, 1);
  assert.ok(queries.every((query) => /^SELECT|^WITH/i.test(typeof query === 'string' ? query : query.sql)));
  assert.ok(queries.every((query) => !/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(typeof query === 'string' ? query : query.sql)));
});

