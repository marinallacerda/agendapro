import { Router, Response } from 'express';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  const user = await db.prepare(
    `SELECT id, email, name, business_name, slug, phone, bio,
            pix_key, pix_key_type, pix_name, pix_city,
            whatsapp_enabled, evolution_api_url, evolution_api_key, evolution_instance,
            reminder_24h, reminder_1h
     FROM users WHERE id = ?`
  ).get(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(user);
});

router.put('/', async (req: AuthRequest, res: Response) => {
  const {
    name, business_name, phone, bio,
    pix_key, pix_key_type, pix_name, pix_city,
    whatsapp_enabled, evolution_api_url, evolution_api_key, evolution_instance,
    reminder_24h, reminder_1h,
  } = req.body;

  await db.prepare(
    `UPDATE users SET
      name = COALESCE(?, name),
      business_name = COALESCE(?, business_name),
      phone = COALESCE(?, phone),
      bio = COALESCE(?, bio),
      pix_key = COALESCE(?, pix_key),
      pix_key_type = COALESCE(?, pix_key_type),
      pix_name = COALESCE(?, pix_name),
      pix_city = COALESCE(?, pix_city),
      whatsapp_enabled = COALESCE(?, whatsapp_enabled),
      evolution_api_url = COALESCE(?, evolution_api_url),
      evolution_api_key = COALESCE(?, evolution_api_key),
      evolution_instance = COALESCE(?, evolution_instance),
      reminder_24h = COALESCE(?, reminder_24h),
      reminder_1h = COALESCE(?, reminder_1h)
    WHERE id = ?`
  ).run(
    name, business_name, phone, bio,
    pix_key, pix_key_type, pix_name, pix_city,
    whatsapp_enabled !== undefined ? (whatsapp_enabled ? 1 : 0) : null,
    evolution_api_url, evolution_api_key, evolution_instance,
    reminder_24h !== undefined ? (reminder_24h ? 1 : 0) : null,
    reminder_1h !== undefined ? (reminder_1h ? 1 : 0) : null,
    req.userId,
  );

  const updated = await db.prepare(
    `SELECT id, email, name, business_name, slug, phone, bio,
            pix_key, pix_key_type, pix_name, pix_city,
            whatsapp_enabled, evolution_api_url, evolution_api_key, evolution_instance,
            reminder_24h, reminder_1h
     FROM users WHERE id = ?`
  ).get(req.userId);
  return res.json(updated);
});

router.post('/test-whatsapp', async (req: AuthRequest, res: Response) => {
  const { phone } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;

  if (!user?.evolution_api_url || !user?.evolution_api_key || !user?.evolution_instance) {
    return res.status(400).json({ error: 'Configure a integração com WhatsApp primeiro' });
  }

  const { sendWhatsAppReminder } = require('../utils/whatsapp');
  sendWhatsAppReminder(user, phone || user.phone, `✅ Teste de conexão do *${user.business_name}* bem-sucedido! 🎉`);
  return res.json({ message: 'Mensagem de teste enviada!' });
});

export default router;
