const express = require('express');

const app = express();
app.use(express.json());
app.use('/api/v1', require('./routes/students'));
app.use('/api/v1', require('./routes/classes'));
app.use('/api/v1', require('./routes/teachers'));
app.get('/api/v1/reports/contacts', async (_req, res) => {
  res.type('text/plain').send(await require('./reports/contact-report').contactReport());
});

app.listen(Number(process.env.PORT ?? 3201), () => console.log('school-b api ready'));
