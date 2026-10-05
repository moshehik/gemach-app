// scripts/lib/backup-paging.js - how the backup scripts (cloud_backup.js, backup_prod_db.js) page through a table.
// 6.10.2026: the backups started failing with 'column "id" does not exist' because DeliveryJoin (created 5.10) has no "id"
// column (its primary key is orderId). Rule now: keyset on "id" when the table has it; else keyset on a SINGLE-column primary
// key; else (composite / no primary key) OFFSET paging ordered by ctid, which is stable inside the backup's REPEATABLE READ
// read-only transaction. Pure helpers + one query function (the client is injected so it can be tested with a fake).
'use strict';

/** @returns {Promise<{kind:'keyset', column:string}|{kind:'offset'}>} */
async function pickPagingKey(client, table, columns, sqlIdent) {
  if (columns.includes('id')) return { kind: 'keyset', column: 'id' };
  const { rows } = await client.query(
    `SELECT a.attname AS name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey::int2[], a.attnum)`,
    [`public.${sqlIdent(table)}`]
  );
  if (rows.length === 1 && columns.includes(rows[0].name)) return { kind: 'keyset', column: rows[0].name };
  return { kind: 'offset' };
}

/** SQL + params for one page. `cursor` = last key value (keyset) or rows already read (offset). */
function buildPageQuery({ table, colList, key, cursor, batchSize, sqlIdent }) {
  if (key.kind === 'keyset') {
    const col = sqlIdent(key.column);
    const first = cursor === null || cursor === undefined;
    return {
      text: `SELECT ${colList} FROM ${sqlIdent(table)} ${first ? '' : `WHERE ${col} > $2`} ORDER BY ${col} LIMIT $1`,
      params: first ? [batchSize] : [batchSize, cursor],
    };
  }
  return {
    text: `SELECT ${colList} FROM ${sqlIdent(table)} ORDER BY ctid LIMIT $1 OFFSET $2`,
    params: [batchSize, cursor || 0],
  };
}

/** Next cursor after a page of rows. */
function nextCursor(key, rows, cursor) {
  if (key.kind === 'keyset') return rows[rows.length - 1][key.column];
  return (cursor || 0) + rows.length;
}

module.exports = { pickPagingKey, buildPageQuery, nextCursor };
