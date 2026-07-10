import { Router, Response } from 'express';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendWhatsAppReminder } from '../utils/whatsapp';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res: Response) => {
  const { service_id, client_name, client_phone, client_email, date, start_time, professional_id, notes } = req.body;

  if (!service_id || !client_name || !date || !start_time) {
    return res.status(400).json({ error: 'Campos obrigatórios: serviço, cliente, data e horário' });
  }

  const service = await db.prepare('SELECT * FROM services WHERE id = ? AND user_id = ?')
    .get(service_id, req.userId) as any;
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const endTime = fromMin(toMin(start_time) + service.duration_minutes);

  const conflicts = await db.prepare(
    `SELECT id FROM appointments
     WHERE user_id = ? AND date = ? AND status != 'cancelled'
     AND start_time < ? AND end_time > ?`
  ).all(req.userId, date, endTime, start_time);

  if (conflicts.length > 0) {
    return res.status(409).json({ error: 'Conflito de horário com agendamento existente' });
  }

  const result = await db.prepare(
    `INSERT INTO appointments
      (user_id, service_id, client_name, client_phone, client_email,
       date, start_time, end_time, status, payment_status, notes, professional_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'pending', ?, ?)`
  ).run(
    req.userId, service_id, client_name, client_phone || '', client_email || '',
    date, start_time, endTime, notes || '', professional_id || null,
  );

  const created = await db.prepare(
    `SELECT a.*, s.name as service_name, s.color as service_color,
            s.price as service_price, s.duration_minutes
     FROM appointments a JOIN services s ON a.service_id = s.id
     WHERE a.id = ?`
  ).get(result.lastInsertRowid);

  return res.status(201).json(created);
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const { from, to, status, date } = req.query;
  let query = `SELECT a.*, s.name as service_name, s.color as service_color,
                      s.price as service_price, s.duration_minutes
               FROM appointments a JOIN services s ON a.service_id = s.id
               WHERE a.user_id = ?`;
  const params: any[] = [req.userId];

  if (from) { query += ' AND a.date >= ?'; params.push(from); }
  if (to)   { query += ' AND a.date <= ?'; params.push(to); }
  if (status) { query += ' AND a.status = ?'; params.push(status); }
  if (date)   { query += ' AND a.date = ?'; params.push(date); }
  query += ' ORDER BY a.date ASC, a.start_time ASC';

  const appointments = await db.prepare(query).all(...params);
  return res.json(appointments);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const apt = await db.prepare(
    `SELECT a.*, s.name as service_name, s.color as service_color, s.price as service_price
     FROM appointments a JOIN services s ON a.service_id = s.id
     WHERE a.id = ? AND a.user_id = ?`
  ).get(req.params.id, req.userId);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado' });
  return res.json(apt);
});

router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status, payment_status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
  const validPayments = ['pending', 'paid'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const existing = await db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId) as any;
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

  const newStatus = status || existing.status;
  const newPayment = payment_status && validPayments.includes(payment_status) ? payment_status : existing.payment_status;

  await db.prepare('UPDATE appointments SET status = ?, payment_status = ? WHERE id = ? AND user_id = ?')
    .run(newStatus, newPayment, req.params.id, req.userId);

  if (status === 'confirmed' && existing.status !== 'confirmed') {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;
    const service = await db.prepare('SELECT * FROM services WHERE id = ?').get(existing.service_id) as any;
    if (user?.whatsapp_enabled) {
      const [y, m, d] = existing.date.split('-');
      const message = `✅ *Agendamento Confirmado!*\n\nOlá ${existing.client_name}! 😊\n\n` +
        `Seu agendamento foi confirmado:\n📋 *Serviço:* ${service.name}\n` +
        `📅 *Data:* ${d}/${m}/${y}\n🕐 *Horário:* ${existing.start_time}\n` +
        `💰 *Valor:* R$ ${Number(service.price).toFixed(2)}\n\nAté breve! 💅`;
      sendWhatsAppReminder(user, existing.client_phone, message);
    }
  }

  const updated = await db.prepare(
    `SELECT a.*, s.name as service_name, s.color as service_color, s.price as service_price
     FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.id = ?`
  ).get(req.params.id);
  return res.json(updated);
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { notes, payment_status } = req.body;
  const existing = await db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

  await db.prepare('UPDATE appointments SET notes = ?, payment_status = ? WHERE id = ? AND user_id = ?')
    .run(notes || '', payment_status || 'pending', req.params.id, req.userId);

  const updated = await db.prepare(
    `SELECT a.*, s.name as service_name, s.color as service_color, s.price as service_price
     FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.id = ?`
  ).get(req.params.id);
  return res.json(updated);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const existing = await db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });
  await db.prepare('DELETE FROM appointments WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  return res.json({ message: 'Agendamento excluído com sucesso' });
});

export default router;
