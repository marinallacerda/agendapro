import { Router, Response } from 'express';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/working-hours', async (req: AuthRequest, res: Response) => {
  const hours = await db.prepare(
    'SELECT * FROM working_hours WHERE user_id = ? ORDER BY day_of_week ASC'
  ).all(req.userId);
  return res.json(hours);
});

router.put('/working-hours', async (req: AuthRequest, res: Response) => {
  const { hours } = req.body;
  if (!Array.isArray(hours)) return res.status(400).json({ error: 'Formato inválido' });

  for (const h of hours) {
    await db.prepare(
      `INSERT INTO working_hours (user_id, day_of_week, start_time, end_time, enabled)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day_of_week) DO UPDATE SET
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         enabled = excluded.enabled`
    ).run(req.userId, h.day_of_week, h.start_time, h.end_time, h.enabled ? 1 : 0);
  }

  const updated = await db.prepare(
    'SELECT * FROM working_hours WHERE user_id = ? ORDER BY day_of_week ASC'
  ).all(req.userId);
  return res.json(updated);
});

router.get('/blocked-slots', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query;
  let query = 'SELECT * FROM blocked_slots WHERE user_id = ?';
  const params: any[] = [req.userId];
  if (from) { query += ' AND date >= ?'; params.push(from); }
  if (to)   { query += ' AND date <= ?'; params.push(to); }
  query += ' ORDER BY date ASC, start_time ASC';
  const slots = await db.prepare(query).all(...params);
  return res.json(slots);
});

router.post('/blocked-slots', async (req: AuthRequest, res: Response) => {
  const { date, start_time, end_time, reason } = req.body;
  if (!date || !start_time || !end_time) {
    return res.status(400).json({ error: 'Data, horário de início e fim são obrigatórios' });
  }
  const result = await db.prepare(
    'INSERT INTO blocked_slots (user_id, date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)'
  ).run(req.userId, date, start_time, end_time, reason || '');
  const slot = await db.prepare('SELECT * FROM blocked_slots WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(slot);
});

router.delete('/blocked-slots/:id', async (req: AuthRequest, res: Response) => {
  const existing = await db.prepare('SELECT * FROM blocked_slots WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Bloqueio não encontrado' });
  await db.prepare('DELETE FROM blocked_slots WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  return res.json({ message: 'Bloqueio removido com sucesso' });
});

export default router;
