import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

function toPostgres(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalize(params: any[]): any[] {
  return params.flat().map(p => (p === undefined ? null : p));
}

class Statement {
  constructor(private sql: string) {}

  async get(...params: any[]): Promise<any> {
    const r = await pool.query(toPostgres(this.sql), normalize(params));
    return r.rows[0] ?? undefined;
  }

  async all(...params: any[]): Promise<any[]> {
    const r = await pool.query(toPostgres(this.sql), normalize(params));
    return r.rows;
  }

  async run(...params: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
    let pgSql = toPostgres(this.sql);
    const upper = pgSql.trim().toUpperCase();
    if (upper.startsWith('INSERT') && !upper.includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
    const r = await pool.query(pgSql, normalize(params));
    return {
      lastInsertRowid: r.rows[0]?.id ?? 0,
      changes: r.rowCount ?? 0,
    };
  }
}

export const db = {
  prepare: (sql: string) => new Statement(sql),
  exec: async (sql: string) => { await pool.query(sql); },
};

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT NOT NULL DEFAULT '',
      slug TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      pix_key TEXT DEFAULT '',
      pix_key_type TEXT DEFAULT 'cpf',
      pix_name TEXT DEFAULT '',
      pix_city TEXT DEFAULT '',
      whatsapp_enabled INTEGER DEFAULT 0,
      evolution_api_url TEXT DEFAULT '',
      evolution_api_key TEXT DEFAULT '',
      evolution_instance TEXT DEFAULT '',
      reminder_24h INTEGER DEFAULT 1,
      reminder_1h INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      color TEXT DEFAULT '#7C3AED',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS working_hours (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '18:00',
      enabled INTEGER DEFAULT 1,
      UNIQUE(user_id, day_of_week)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL DEFAULT '',
      client_email TEXT DEFAULT '',
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      professional_id INTEGER DEFAULT NULL,
      reminder_24h_sent INTEGER DEFAULT 0,
      reminder_1h_sent INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocked_slots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reason TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT DEFAULT '',
      birth_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      skin_type TEXT DEFAULT '',
      allergies TEXT DEFAULT '',
      medications TEXT DEFAULT '',
      pregnant INTEGER DEFAULT 0,
      conditions TEXT DEFAULT '',
      avatar_color TEXT DEFAULT '#6D5BBA',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS professionals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      specialty TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      commission_pct DECIMAL(5,2) DEFAULT 40,
      color TEXT DEFAULT '#3A6650',
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Safe migration: add professional_id if missing (for existing databases)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'professional_id'
      ) THEN
        ALTER TABLE appointments ADD COLUMN professional_id INTEGER DEFAULT NULL;
      END IF;
    END $$
  `);

  console.log('✅ Database initialized (PostgreSQL)');
}

export async function seedDefaultWorkingHours(userId: number) {
  const days = [
    { day: 0, enabled: 0 }, { day: 1, enabled: 1 }, { day: 2, enabled: 1 },
    { day: 3, enabled: 1 }, { day: 4, enabled: 1 }, { day: 5, enabled: 1 },
    { day: 6, enabled: 0 },
  ];
  for (const d of days) {
    await pool.query(
      `INSERT INTO working_hours (user_id, day_of_week, start_time, end_time, enabled)
       VALUES ($1, $2, '09:00', '18:00', $3)
       ON CONFLICT (user_id, day_of_week) DO NOTHING`,
      [userId, d.day, d.enabled]
    );
  }
}
