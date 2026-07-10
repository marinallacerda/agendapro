import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, seedDefaultWorkingHours } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 30) + '-' + Math.random().toString(36).substring(2, 7);
}

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, business_name } = req.body;

  if (!email || !password || !name || !business_name) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
  }

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email já cadastrado' });

  const password_hash = bcrypt.hashSync(password, 10);
  const slug = generateSlug(business_name);

  const result = await db.prepare(
    'INSERT INTO users (email, password_hash, name, business_name, slug) VALUES (?, ?, ?, ?, ?)'
  ).run(email, password_hash, name, business_name, slug);

  await seedDefaultWorkingHours(result.lastInsertRowid);

  const token = jwt.sign(
    { userId: result.lastInsertRowid },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '30d' }
  );

  const user = await db.prepare(
    'SELECT id, email, name, business_name, slug FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);

  return res.status(201).json({ token, user });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '30d' }
  );

  const { password_hash, ...userSafe } = user;
  return res.json({ token, user: userSafe });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await db.prepare(
    `SELECT id, email, name, business_name, slug, phone, bio, avatar_url,
            pix_key, pix_key_type, pix_name, pix_city,
            whatsapp_enabled, evolution_api_url, evolution_api_key, evolution_instance,
            reminder_24h, reminder_1h
     FROM users WHERE id = ?`
  ).get(req.userId);

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(user);
});

router.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { current_password, new_password } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as any;

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.userId);
  return res.json({ message: 'Senha alterada com sucesso' });
});

export default router;
