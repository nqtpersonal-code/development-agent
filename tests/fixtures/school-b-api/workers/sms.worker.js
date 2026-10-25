// Queue consumer: sends pending SMS messages to students.
const { pool } = require('../db/pool');

async function consumeOnce() {
  const [jobs] = await pool.query(
    'SELECT q.id, q.message, s.phone FROM sms_queue q JOIN students s ON s.id = q.student_id WHERE q.sent_at IS NULL',
  );
  for (const job of jobs) {
    if (!job.phone) continue;
    console.log(`SMS -> ${job.phone}: ${job.message}`);
    await pool.query('UPDATE sms_queue SET sent_at = NOW() WHERE id = ?', [job.id]);
  }
}

if (require.main === module) consumeOnce().then(() => process.exit(0));

module.exports = { consumeOnce };
