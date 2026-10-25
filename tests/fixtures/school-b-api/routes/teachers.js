const express = require('express');
const { repo } = require('../db/repo');

const router = express.Router();

// Teacher contact card (phone here is the teacher's phone).
router.get('/teachers/:id', async (req, res) => {
  const teacher = await repo('teachers').find(Number(req.params.id), ['id', 'full_name', 'phone']);
  res.json(teacher);
});

module.exports = router;
