import express from 'express';

const app = express();

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.listen(3001, () => {
  console.log('API server on http://localhost:3001');
});
