import cron from 'node-cron';
import { db } from '../database';
import { sendWhatsAppReminder } from './whatsapp';

function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

async function sendDayBeforeReminders() {
  const tomorrow = getTomorrowStr();
  const appointments = await db.prepare(
    `SELECT a.*, s.name as service_name, s.price, u.business_name, u.pix_key,
            u.evolution_api_url, u.evolution_api_key, u.evolution_instance,
            u.whatsapp_enabled, u.reminder_24h
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     JOIN users u ON a.user_id = u.id
     WHERE a.date = ? AND a.status IN ('pending', 'confirmed')
       AND a.reminder_24h_sent = 0 AND u.whatsapp_enabled = 1 AND u.reminder_24h = 1`
  ).all(tomorrow) as any[];

  for (const apt of appointments) {
    const [y, m, d] = apt.date.split('-');
    const message =
      `🔔 *Lembrete de Agendamento*\n\nOlá ${apt.client_name}! 😊\n\n` +
      `Você tem um agendamento *amanhã*:\n` +
      `💅 *Serviço:* ${apt.service_name}\n📅 *Data:* ${d}/${m}/${y}\n` +
      `🕐 *Horário:* ${apt.start_time}\n💰 *Valor:* R$ ${Number(apt.price).toFixed(2)}\n\n` +
      `📍 *${apt.business_name}*\n\nPara cancelar ou reagendar, entre em contato.`;
    await sendWhatsAppReminder(apt, apt.client_phone, message);
    await db.prepare('UPDATE appointments SET reminder_24h_sent = 1 WHERE id = ?').run(apt.id);
  }
}

async function sendHourBeforeReminders() {
  const today = getTodayStr();
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const th = inOneHour.getHours();
  const tm = inOneHour.getMinutes();
  const minTime = `${String(th).padStart(2, '0')}:${String(Math.max(0, tm - 5)).padStart(2, '0')}`;
  const maxTime = `${String(th).padStart(2, '0')}:${String(Math.min(59, tm + 5)).padStart(2, '0')}`;

  const appointments = await db.prepare(
    `SELECT a.*, s.name as service_name, s.price, u.business_name,
            u.evolution_api_url, u.evolution_api_key, u.evolution_instance,
            u.whatsapp_enabled, u.reminder_1h
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     JOIN users u ON a.user_id = u.id
     WHERE a.date = ? AND a.status IN ('pending', 'confirmed')
       AND a.start_time BETWEEN ? AND ?
       AND a.reminder_1h_sent = 0 AND u.whatsapp_enabled = 1 AND u.reminder_1h = 1`
  ).all(today, minTime, maxTime) as any[];

  for (const apt of appointments) {
    const message =
      `⏰ *Lembrete: Em 1 hora!*\n\nOlá ${apt.client_name}! 😊\n\n` +
      `Seu agendamento é *em 1 hora*:\n` +
      `💅 *Serviço:* ${apt.service_name}\n🕐 *Horário:* ${apt.start_time}\n` +
      `💰 *Valor:* R$ ${Number(apt.price).toFixed(2)}\n\n📍 *${apt.business_name}*\n\nTe esperamos! 💜`;
    await sendWhatsAppReminder(apt, apt.client_phone, message);
    await db.prepare('UPDATE appointments SET reminder_1h_sent = 1 WHERE id = ?').run(apt.id);
  }
}

export function startCronJobs() {
  cron.schedule('0 9 * * *', async () => {
    console.log('🔔 Enviando lembretes do dia seguinte...');
    await sendDayBeforeReminders();
  });
  cron.schedule('0 * * * *', async () => {
    console.log('🔔 Verificando lembretes de 1 hora...');
    await sendHourBeforeReminders();
  });
  console.log('⏰ Cron jobs iniciados');
}
