import { Router, Response } from 'express';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  const professionals = await db.prepare(
    'SELECT * FROM professionals WHERE user_id = ? ORDER BY name ASC'
  ).all(req.userId);
  return res.json(professionals);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const pro = await db.prepare('SELECT * FROM professionals WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!pro) return res.status(404).json({ error: 'Profissional não encontrado' });
  return res.json(pro);
});

router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  const pro = await db.prepare('SELECT * FROM professionals WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as any;
  if (!pro) return res.status(404).json({ error: 'Profissional não encontrado' });

  const stats = await db.prepare(
    `SELECT
       COUNT(*) as total_appointments,
       COALESCE(SUM(s.price), 0) as total_revenue,
       COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.user_id = ? AND a.professional_id = ?`
  ).get(req.userId, req.params.id) as any;

  const commission = (Number(stats?.total_revenue) || 0) * (pro.commission_pct / 100);
  return res.json({ ...stats, commission });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, specialty, phone, email, commission_pct, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const result = await db.prepare(
    'INSERT INTO professionals (user_id, name, specialty, phone, email, commission_pct, color) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.userId, name, specialty || '', phone || '', email || '', commission_pct ?? 40, color || '#3A6650');

  const pro = await db.prepare('SELECT * FROM professionals WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(pro);
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await db.prepare('SELECT * FROM professionals WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Profissional não encontrado' });

  const { name, specialty, phone, email, commission_pct, color, active } = req.body;
  await db.prepare(
    `UPDATE professionals SET
       name = ?, specialty = ?, phone = ?, email = ?,
       commission_pct = ?, color = ?, active = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    name, specialty || '', phone || '', email || '',
    commission_pct ?? 40, color || '#3A6650',
    active !== undefined ? (active ? 1 : 0) : 1,
    req.params.id, req.userId,
  );

  const updated = await db.prepare('SELECT * FROM professionals WHERE id = ?').get(req.params.id);
  return res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await db.prepare('SELECT * FROM professionals WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Profissional não encontrado' });
  await db.prepare('DELETE FROM professionals WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  return res.json({ message: 'Profissional excluído com sucesso' });
});

export default router;
