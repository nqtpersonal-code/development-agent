const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

router.get('/classes/:id/students', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.id, s.full_name, s.phone
     FROM enrollments e JOIN students s ON s.id = e.student_id
     WHERE e.class_id = ? AND s.deleted_at IS NULL
     ORDER BY s.full_name`,
    [Number(req.params.id)],
  );
  res.json(rows);
});

module.exports = router;
