import { Router, Response } from 'express';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { search } = req.query;
  let query = 'SELECT * FROM clients WHERE user_id = ?';
  const params: any[] = [req.userId];

  if (search) {
    query += ' AND (name ILIKE ? OR phone ILIKE ? OR email ILIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  query += ' ORDER BY name ASC';
  const clients = await db.prepare(query).all(...params);
  return res.json(clients);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const client = await db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  return res.json(client);
});

router.get('/:id/history', async (req: AuthRequest, res: Response) => {
  const appointments = await db.prepare(
    `SELECT a.*, s.name as service_name, s.color as service_color, s.price as service_price
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.user_id = ? AND (
       a.client_phone = (SELECT phone FROM clients WHERE id = ? AND user_id = ?)
       OR a.client_name = (SELECT name FROM clients WHERE id = ? AND user_id = ?)
     )
     ORDER BY a.date DESC, a.start_time DESC
     LIMIT 20`
  ).all(req.userId, req.params.id, req.userId, req.params.id, req.userId);

  const stats = await db.prepare(
    `SELECT
       COUNT(*) as total_visits,
       COALESCE(SUM(s.price), 0) as total_spent,
       MAX(a.date) as last_visit
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.user_id = ? AND a.status = 'completed' AND (
       a.client_phone = (SELECT phone FROM clients WHERE id = ? AND user_id = ?)
       OR a.client_name = (SELECT name FROM clients WHERE id = ? AND user_id = ?)
     )`
  ).get(req.userId, req.params.id, req.userId, req.params.id, req.userId);

  return res.json({ appointments, stats });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, phone, email, birth_date, notes, skin_type, allergies, medications, pregnant, conditions, avatar_color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const result = await db.prepare(
    `INSERT INTO clients
      (user_id, name, phone, email, birth_date, notes, skin_type, allergies, medications, pregnant, conditions, avatar_color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.userId, name, phone || '', email || '', birth_date || '',
    notes || '', skin_type || '', allergies || '', medications || '',
    pregnant ? 1 : 0, conditions || '', avatar_color || '#6D5BBA',
  );

  const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(client);
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });

  const { name, phone, email, birth_date, notes, skin_type, allergies, medications, pregnant, conditions, avatar_color } = req.body;

  await db.prepare(
    `UPDATE clients SET
       name = ?, phone = ?, email = ?, birth_date = ?, notes = ?,
       skin_type = ?, allergies = ?, medications = ?, pregnant = ?,
       conditions = ?, avatar_color = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    name, phone || '', email || '', birth_date || '', notes || '',
    skin_type || '', allergies || '', medications || '',
    pregnant ? 1 : 0, conditions || '', avatar_color || '#6D5BBA',
    req.params.id, req.userId,
  );

  const updated = await db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  return res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });
  await db.prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  return res.json({ message: 'Cliente excluído com sucesso' });
});

export default router;
