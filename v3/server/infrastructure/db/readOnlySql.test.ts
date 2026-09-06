import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReadOnlySql } from './readOnlySql.js';

test('read-only SQL accepts SELECT and WITH statements', () => {
  assert.doesNotThrow(() => assertReadOnlySql('SELECT id FROM users WHERE id = ?'));
  assert.doesNotThrow(() => assertReadOnlySql('WITH rows AS (SELECT 1) SELECT * FROM rows'));
});

test('read-only SQL rejects every write statement and multiple statements', () => {
  for (const sql of [
    'INSERT INTO users (name) VALUES (?)',
    'UPDATE users SET name = ?',
    'DELETE FROM users',
    'ALTER TABLE users ADD COLUMN test TEXT',
    'SELECT 1; DELETE FROM users',
    'WITH rows AS (SELECT 1) UPDATE users SET name = "unsafe"',
  ]) {
    assert.throws(() => assertReadOnlySql(sql));
  }
});
