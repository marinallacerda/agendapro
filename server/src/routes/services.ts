import { Router, Response } from 'express';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  const services = await db.prepare(
    'SELECT * FROM services WHERE user_id = ? ORDER BY name ASC'
  ).all(req.userId);
  return res.json(services);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, description, duration_minutes, price, color } = req.body;
  if (!name || !duration_minutes || price === undefined) {
    return res.status(400).json({ error: 'Nome, duração e preço são obrigatórios' });
  }

  const result = await db.prepare(
    'INSERT INTO services (user_id, name, description, duration_minutes, price, color) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, name, description || '', duration_minutes, price, color || '#7C3AED');

  const service = await db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(service);
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, duration_minutes, price, active, color } = req.body;

  const existing = await db.prepare('SELECT * FROM services WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });

  await db.prepare(
    'UPDATE services SET name = ?, description = ?, duration_minutes = ?, price = ?, active = ?, color = ? WHERE id = ? AND user_id = ?'
  ).run(name, description, duration_minutes, price, active ? 1 : 0, color, id, req.userId);

  const updated = await db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  return res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = await db.prepare('SELECT * FROM services WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });

  const hasAppointments = await db.prepare(
    "SELECT id FROM appointments WHERE service_id = ? AND status NOT IN ('cancelled', 'completed')"
  ).get(id);
  if (hasAppointments) {
    return res.status(400).json({ error: 'Não é possível excluir um serviço com agendamentos ativos. Desative-o primeiro.' });
  }

  await db.prepare('DELETE FROM services WHERE id = ? AND user_id = ?').run(id, req.userId);
  return res.json({ message: 'Serviço excluído com sucesso' });
});

export default router;
