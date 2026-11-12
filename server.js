import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const saves = new Map();                       // слоты сохранений в памяти
app.post('/api/save/:slot', (req, res) => {
  saves.set(req.params.slot, req.body);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});
app.get('/api/save/:slot', (req, res) => res.json(saves.get(req.params.slot) ?? null));
app.get('/api/saves', (_req, res) => res.json([...saves.keys()]));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Political Rivalry → http://localhost:${PORT}`));