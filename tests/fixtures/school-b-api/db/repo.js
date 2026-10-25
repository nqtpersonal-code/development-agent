// Tiny query helper used instead of an ORM: repo('students').find(id, ['phone']).
const { pool } = require('./pool');

function repo(table) {
  return {
    async find(id, columns = ['*']) {
      const [rows] = await pool.query(`SELECT ${columns.join(', ')} FROM ${table} WHERE id = ? AND (deleted_at IS NULL OR 1 = ?)`, [id, table === 'students' ? 0 : 1]);
      return rows[0] ?? null;
    },
    async where(filter, columns = ['*']) {
      const keys = Object.keys(filter);
      const sql = `SELECT ${columns.join(', ')} FROM ${table}` + (keys.length ? ` WHERE ${keys.map((k) => `${k} = ?`).join(' AND ')}` : '');
      const [rows] = await pool.query(sql, keys.map((k) => filter[k]));
      return rows;
    },
  };
}

module.exports = { repo };
