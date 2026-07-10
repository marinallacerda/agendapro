import { Router, Response } from 'express';
import { db } from '../database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/overview', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query;
  const params: any[] = [req.userId];
  let dateFilter = '';
  if (from) { dateFilter += ' AND a.date >= ?'; params.push(from); }
  if (to)   { dateFilter += ' AND a.date <= ?'; params.push(to); }

  const summary = await db.prepare(
    `SELECT
       COUNT(*)                                                     AS total,
       COUNT(CASE WHEN a.status = 'completed'  THEN 1 END)         AS completed,
       COUNT(CASE WHEN a.status = 'cancelled'  THEN 1 END)         AS cancelled,
       COUNT(CASE WHEN a.status = 'confirmed'  THEN 1 END)         AS confirmed,
       COUNT(CASE WHEN a.status = 'pending'    THEN 1 END)         AS pending,
       COALESCE(SUM(CASE WHEN a.status NOT IN ('cancelled') THEN s.price END), 0) AS revenue,
       COALESCE(AVG(CASE WHEN a.status = 'completed' THEN s.price END), 0)        AS avg_ticket,
       COUNT(DISTINCT a.client_phone)                               AS unique_clients
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.user_id = ? ${dateFilter}`
  ).get(...params);
  return res.json(summary);
});

router.get('/revenue-by-day', async (req: AuthRequest, res: Response) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });

  const rows = await db.prepare(
    `SELECT
       a.date,
       COALESCE(SUM(s.price), 0) AS revenue,
       COUNT(*) AS count
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.user_id = ?
       AND a.date LIKE ?
       AND a.status NOT IN ('cancelled')
     GROUP BY a.date
     ORDER BY a.date ASC`
  ).all(req.userId, `${month}%`);
  return res.json(rows);
});

router.get('/top-services', async (req: AuthRequest, res: Response) => {
  const { from, to, limit: lim } = req.query;
  const params: any[] = [req.userId];
  let dateFilter = '';
  if (from) { dateFilter += ' AND a.date >= ?'; params.push(from); }
  if (to)   { dateFilter += ' AND a.date <= ?'; params.push(to); }

  const rows = await db.prepare(
    `SELECT
       s.name,
       s.color,
       COUNT(*) AS count,
       COALESCE(SUM(s.price), 0) AS revenue
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     WHERE a.user_id = ?
       AND a.status NOT IN ('cancelled')
       ${dateFilter}
     GROUP BY s.id, s.name, s.color
     ORDER BY revenue DESC
     LIMIT ?`
  ).all(...params, Number(lim) || 5);
  return res.json(rows);
});

router.get('/by-professional', async (req: AuthRequest, res: Response) => {
  const { from, to } = req.query;
  const params: any[] = [req.userId];
  let dateFilter = '';
  if (from) { dateFilter += ' AND a.date >= ?'; params.push(from); }
  if (to)   { dateFilter += ' AND a.date <= ?'; params.push(to); }

  const rows = await db.prepare(
    `SELECT
       COALESCE(p.name, 'Sem profissional') AS name,
       p.color,
       p.commission_pct,
       COUNT(*) AS count,
       COALESCE(SUM(s.price), 0) AS revenue
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     LEFT JOIN professionals p ON a.professional_id = p.id
     WHERE a.user_id = ?
       AND a.status NOT IN ('cancelled')
       ${dateFilter}
     GROUP BY a.professional_id, p.name, p.color, p.commission_pct
     ORDER BY revenue DESC`
  ).all(...params);
  return res.json(rows);
});

export default router;
