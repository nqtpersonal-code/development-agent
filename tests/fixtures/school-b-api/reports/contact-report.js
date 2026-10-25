// Contact report: the table name is assembled at runtime.
const { pool } = require('../db/pool');

const PREFIX = 'stud';

async function contactReport(kind = 'ents') {
  const table = PREFIX + kind;
  const [rows] = await pool.query('SELECT full_name, phone FROM ' + table + ' ORDER BY full_name');
  return rows.map((r) => `${r.full_name};${r.phone ?? ''}`).join('\n');
}

module.exports = { contactReport };
