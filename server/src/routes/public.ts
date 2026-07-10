import { Router, Request, Response } from 'express';
import { db } from '../database';
import { generatePixPayload, generatePixQrCode } from '../utils/pix';
import { sendWhatsAppReminder } from '../utils/whatsapp';

const router = Router();

async function getUser(slug: string) {
  return db.prepare('SELECT * FROM users WHERE slug = ?').get(slug) as any;
}

function generateAvailableSlots(
  workingHours: any[],
  appointments: any[],
  blockedSlots: any[],
  date: string,
  durationMinutes: number
): string[] {
  const dow = new Date(`${date}T12:00:00`).getDay();
  const wh = workingHours.find((h: any) => h.day_of_week === dow && h.enabled);
  if (!wh) return [];

  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toTime = (m: number) =>
    `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;

  const startMins = toMinutes(wh.start_time);
  const endMins = toMinutes(wh.end_time);
  const slots: string[] = [];

  for (let t = startMins; t + durationMinutes <= endMins; t += 30) {
    const slotEnd = t + durationMinutes;
    const busy = appointments.some((a: any) => {
      const aStart = toMinutes(a.start_time);
      const aEnd = toMinutes(a.end_time);
      return t < aEnd && slotEnd > aStart;
    }) || blockedSlots.some((b: any) => {
      const bStart = toMinutes(b.start_time);
      const bEnd = toMinutes(b.end_time);
      return t < bEnd && slotEnd > bStart;
    });
    if (!busy) slots.push(toTime(t));
  }
  return slots;
}

router.get('/:slug/info', async (req: Request, res: Response) => {
  const user = await getUser(req.params.slug);
  if (!user) return res.status(404).json({ error: 'Profissional não encontrado' });
  return res.json({
    name: user.name,
    business_name: user.business_name,
    bio: user.bio,
    phone: user.phone,
    slug: user.slug,
  });
});

router.get('/:slug/services', async (req: Request, res: Response) => {
  const user = await getUser(req.params.slug);
  if (!user) return res.status(404).json({ error: 'Profissional não encontrado' });
  const services = await db.prepare(
    'SELECT id, name, description, duration_minutes, price, color FROM services WHERE user_id = ? AND active = 1 ORDER BY name ASC'
  ).all(user.id);
  return res.json(services);
});

router.get('/:slug/available-slots', async (req: Request, res: Response) => {
  const { date, service_id } = req.query;
  if (!date || !service_id) return res.status(400).json({ error: 'Data e serviço são obrigatórios' });

  const user = await getUser(req.params.slug);
  if (!user) return res.status(404).json({ error: 'Profissional não encontrado' });

  const service = await db.prepare(
    'SELECT * FROM services WHERE id = ? AND user_id = ? AND active = 1'
  ).get(service_id as string, user.id) as any;
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

  const workingHours = await db.prepare('SELECT * FROM working_hours WHERE user_id = ?').all(user.id);
  const appointments = await db.prepare(
    "SELECT start_time, end_time FROM appointments WHERE user_id = ? AND date = ? AND status NOT IN ('cancelled')"
  ).all(user.id, date as string);
  const blockedSlots = await db.prepare(
    'SELECT start_time, end_time FROM blocked_slots WHERE user_id = ? AND date = ?'
  ).all(user.id, date as string);

  const slots = generateAvailableSlots(workingHours, appointments, blockedSlots, date as string, service.duration_minutes);
  return res.json(slots);
});

router.post('/:slug/book', async (req: Request, res: Response) => {
  const { service_id, date, start_time } = req.body;
  const client_name = req.body.client_name || req.body.name || '';
  const client_phone = req.body.client_phone || req.body.phone || '';
  const client_email = req.body.client_email || req.body.email || '';
  const notes = req.body.notes || '';

  if (!service_id || !date || !start_time || !client_name.trim() || !client_phone.trim()) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
  }

  const user = await getUser(req.params.slug);
  if (!user) return res.status(404).json({ error: 'Profissional não encontrado' });

  const service = await db.prepare(
    'SELECT * FROM services WHERE id = ? AND user_id = ? AND active = 1'
  ).get(service_id, user.id) as any;
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });

  const toMinutes = (t: string) => t.split(':').map(Number).reduce((h, m) => h * 60 + m);
  const toTime = (m: number) =>
    `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;

  const endTime = toTime(toMinutes(start_time) + service.duration_minutes);

  const conflict = await db.prepare(
    `SELECT id FROM appointments
     WHERE user_id = ? AND date = ? AND status NOT IN ('cancelled')
       AND start_time < ? AND end_time > ?`
  ).get(user.id, date, endTime, start_time);
  if (conflict) return res.status(409).json({ error: 'Horário não disponível, escolha outro' });

  const result = await db.prepare(
    `INSERT INTO appointments
      (user_id, service_id, client_name, client_phone, client_email, date, start_time, end_time, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(user.id, service_id, client_name, client_phone, client_email, date, start_time, endTime, notes);

  const appointmentId = result.lastInsertRowid;

  let pixQrCode = '';
  let pixPayload = '';
  if (user.pix_key) {
    pixPayload = generatePixPayload(user.pix_key, user.pix_name || user.name, user.pix_city || 'Brasil', service.price, `AG${appointmentId}`);
    pixQrCode = await generatePixQrCode(user.pix_key, user.pix_name || user.name, user.pix_city || 'Brasil', service.price);
  }

  if (user.whatsapp_enabled) {
    const [y, m, d] = date.split('-');
    const message =
      `🎉 *Agendamento Recebido!*\n\nOlá ${client_name}! 😊\n\n` +
      `Seu agendamento foi recebido:\n` +
      `💅 *Serviço:* ${service.name}\n📅 *Data:* ${d}/${m}/${y}\n` +
      `🕐 *Horário:* ${start_time}\n💰 *Valor:* R$ ${Number(service.price).toFixed(2)}\n\n` +
      `📍 *${user.business_name}*\n\nAguarde a confirmação. 💜`;
    sendWhatsAppReminder(user, client_phone, message);
  }

  return res.status(201).json({
    id: appointmentId, date, start_time, end_time: endTime,
    service_name: service.name, service_price: service.price,
    client_name, status: 'pending',
    pix_qr_code: pixQrCode, pix_payload: pixPayload,
    business_name: user.business_name,
  });
});

router.get('/:slug/appointment/:id', async (req: Request, res: Response) => {
  const user = await getUser(req.params.slug);
  if (!user) return res.status(404).json({ error: 'Profissional não encontrado' });

  const apt = await db.prepare(
    `SELECT a.*, s.name as service_name, s.price as service_price, s.duration_minutes
     FROM appointments a JOIN services s ON a.service_id = s.id
     WHERE a.id = ? AND a.user_id = ?`
  ).get(req.params.id, user.id);
  if (!apt) return res.status(404).json({ error: 'Agendamento não encontrado' });
  return res.json(apt);
});

export default router;
