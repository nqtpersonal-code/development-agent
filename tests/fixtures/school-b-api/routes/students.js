const express = require('express');
const { repo } = require('../db/repo');

const router = express.Router();

router.get('/students/:id', async (req, res) => {
  const student = await repo('students').find(Number(req.params.id), ['id', 'full_name', 'phone']);
  if (!student) return res.status(404).json({ message: 'Không tìm thấy học sinh' });
  res.json(student);
});

module.exports = router;
